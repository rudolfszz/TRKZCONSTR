import fetch from 'node-fetch';

export const getEmbedding = async (text) => {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input: text, model: 'text-embedding-3-small' })
    });
    const json = await res.json();
    return json.data[0].embedding;
};

export const chatWithContext = async (context, question) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'Answer based on context.' },
                { role: 'user', content: `${context}\n\nQ: ${question}` }
            ]
        })
    });

    const json = await res.json();
    return json.choices[0].message.content;
};
