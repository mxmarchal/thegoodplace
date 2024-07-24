addEventListener('fetch', (event) => {
	event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
	if (request.method === 'OPTIONS') {
		return handleOptions(request);
	}
	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { status: 405 });
	}

	try {
		const { message } = await request.json();

		if (!message) {
			return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
		}

		const openaiApiKey = OPENAI_API_KEY;
		const openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
		const systemPrompt = `
You will be given an action performed by the user. Respond with a valid JSON in the following format:

\`\`\`json
{
  "action": "string",
  "sub-actions": [
    {"action": "string", "severity": int}
  ],
  "keywords": ["string"],
  "severity": int,
  "factor": int
}
\`\`\`

• The “action” should be a concise summary of the action (preferably 4-5 words or less, maximum 10 words).
• “sub-actions” are all the underlying actions and implications for people, the planet, ecology, customs, etc. Each sub-action should have a severity rating.
• Severity rating: 0 = positive, 5 = neutral, 10 = very serious.
• “keywords” should be a list of 10 words or proper nouns related to the action.
• “severity” is the overall seriousness of the action (0 to 10).
• “factor” is a metric to assess the impact of the action (1 = everyday task, 1000 = significant impact).

If the language is not English, translate the action and respond in English.

Example:

Action: Eating a hamburger

Response:

\`\`\`json
{
  "action": "eating a hamburger",
  "sub-actions": [
    {"action": "tastes good", "severity": 2},
    {"action": "bad for health", "severity": 6},
    {"action": "supports intensive farming", "severity": 7},
    {"action": "promotes fast food industry", "severity": 5}
  ],
  "keywords": ["food", "health", "meat", "farming", "fast food", "nutrition", "ecology", "diet", "restaurant", "environment"],
  "severity": 6,
  "factor": 50
}
\`\`\`

Remember to think about all the implications of the action in the sub-actions.
Do not include any Markdown or other formatting in the response. Only provide the JSON output.
        `;
		const openaiResponse = await fetch(openaiApiUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${openaiApiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: message },
				],
			}),
		});

		const openaiData = await openaiResponse.json();
		const aiResponse = openaiData.choices[0].message.content;

		return new Response(JSON.stringify({ response: aiResponse }), {
			headers: { 'Content-Type': 'application/json', ...corsHeaders() },
		});
	} catch (error) {
		console.error('Error:', error);
		return new Response(JSON.stringify({ error: 'An error occurred while communicating with OpenAI' }), {
			status: 500,
			headers: corsHeaders(),
		});
	}
}

function handleOptions(request) {
	return new Response(null, {
		status: 204,
		headers: {
			...corsHeaders(),
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
		},
	});
}

function corsHeaders() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	};
}
