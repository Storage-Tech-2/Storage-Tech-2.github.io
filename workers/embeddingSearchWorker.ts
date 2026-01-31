import { env, AutoModel, AutoTokenizer, BertTokenizer, BertModel, Tensor } from "@huggingface/transformers";

env.allowLocalModels = true;
env.localModelPath = self.location.origin + '/models';
env.allowRemoteModels = false;
env.backends.onnx.device = 'wasm';
if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = self.location.origin + '/ort/';
}


let model: BertModel | null = null;
let tokenizer: BertTokenizer | null = null;
let loaded = false;

async function loadModel() {
    const [tokenizerInstance, modelInstance] = await Promise.all([
        AutoTokenizer.from_pretrained('embeddings'),
        AutoModel.from_pretrained('embeddings'),
    ]);
    tokenizer = tokenizerInstance;
    model = modelInstance;
    loaded = true;

    postMessage({ type: 'modelLoaded' });
}

const loadingPromise: Promise<void> = loadModel();


interface EmbeddingsEntryRaw {
    identifier: string;
    embedding: string;
}

interface EmbeddingsEntry {
    identifier: string;
    embedding: Int8Array;
}

const embeddingsCache = new Map<string, EmbeddingsEntry[]>();

function base64ToInt8Array(base64: string): Int8Array {
    const binaryString = Buffer.from(base64, 'base64');
    return new Int8Array(binaryString);
}

async function getEmbedding(text: string): Promise<Int8Array> {
    if (!loaded) {
        await loadingPromise;
    }
    if (!tokenizer || !model) {
        throw new Error('Model or tokenizer not loaded');
    }

    const inputs = await tokenizer([text], { padding: true });
    const output = await model(inputs, { outputEmbeddings: true });

    const embedding = output.sentence_embedding as Tensor;

    // truncate it to 256 dimensions
    const truncatedData: Float32Array = embedding.data.slice(0, 256) as Float32Array;

    // now we need to quantize it,
    /*
     ranges = torch.tensor([[-0.3], [+0.3]]).expand(2, embeddings.shape[1]).cpu().numpy()
            quantized = quantize_embeddings(embeddings, "int8", ranges=ranges)
    */
    const min = -0.3;
    const max = 0.3;
    const scale = 255 / (max - min); // 256 levels for int8

    const quantizedData = new Int8Array(truncatedData.length);
    for (let i = 0; i < truncatedData.length; i++) {
        let quantizedValue = Math.round((truncatedData[i] - min) * scale) - 128; // shift to int8 range
        if (quantizedValue < -128) quantizedValue = -128;
        if (quantizedValue > 127) quantizedValue = 127;
        quantizedData[i] = quantizedValue;
    }

    return quantizedData;
}

export function cosineSimilarity(vecA: Int8Array, vecB: Int8Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) {
        return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const onMessage = async (event: MessageEvent) => {
    const { data } = event;
    if (data.type === 'setEmbeddings') {
        const { requestId, key, entries } = data;
        const parsedEntries: EmbeddingsEntry[] = entries.map((entry: EmbeddingsEntryRaw) => ({
            identifier: entry.identifier,
            embedding: base64ToInt8Array(entry.embedding),
        }));
        embeddingsCache.set(key, parsedEntries);
        postMessage({ type: 'setEmbeddingsComplete', requestId });
    } else if (data.type === 'getScores') {
        const { requestId, key, query } = data;
        try {
            const entries = embeddingsCache.get(key);
            if (!entries) {
                throw new Error(`No embeddings found for key: ${key}`);
            }
            
            const output = await getEmbedding("Represent this sentence for searching relevant passages: " + query);
            const scores = entries.map((entry) => {
                const score = cosineSimilarity(output, entry.embedding);
                return {
                    identifier: entry.identifier,
                    score,
                };
            });
            
            postMessage({ type: 'getScoresComplete', requestId, scores });
        } catch (error) {
            postMessage({ type: 'getScoresError', requestId, error: (error as Error).message });
        }
    }
}



addEventListener('message', onMessage);

