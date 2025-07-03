import { getEmbedding, chatWithContext } from '../services/openaiService.js';
import { vectorStore } from '../utils/vectorStore.js';
import { cosineSimilarity } from '../utils/similarity.js';

export const askQuestion = async (req, res) => {
    const { question } = req.body;
    const embedding = await getEmbedding(question);

    const results = vectorStore.map(item => ({
        text: item.text,
        score: cosineSimilarity(item.embedding, embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

    const context = results.map(r => r.text).join('\n');
    const answer = await chatWithContext(context, question);
    res.json({ answer });
};
