import OpenAI from 'openai';

interface Env {
	DB: D1Database;
	OPENAI_API_KEY: string;
}

interface MainRouteRequest {
	userUuid: string;
	message: string;
}

interface UserRouteRequest {
	username: string;
}

interface SubAction {
	action: string;
	severity: number;
}

interface Action {
	action: string;
	subactions: SubAction[];
	keywords: string[];
	severity: number;
	factor: number;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			await env.DB.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT);').run();
			//table actions with id, action, subactions, keywords, severity, factor, user_id (foreign key) and created_at
			await env.DB.prepare(
				'CREATE TABLE IF NOT EXISTS actions (id TEXT PRIMARY KEY, action TEXT, subactions TEXT, keywords TEXT, severity INTEGER, factor INTEGER, user_id TEXT, created_at TEXT);'
			).run();
		} catch (error) {
			console.error('Error:', error);
			return new Response(JSON.stringify({ error: 'An error occurred' }), {
				status: 500,
				headers: corsHeaders(),
			});
		}
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return handleOptions(request);
		}

		if (url.pathname === '/' && request.method === 'POST') {
			return handleMainRoute(request, env);
		}

		if (url.pathname === '/user' && request.method === 'POST') {
			return handleUserRoute(request, env);
		}

		const userUuidPattern = /^\/user\/([0-9a-fA-F-]{36})$/;
		const match = url.pathname.match(userUuidPattern);
		if (match && request.method === 'GET') {
			return handleUserUUIDRoute(request, match[1], env);
		}

		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

function isOpenAiResponse(response: any): response is Action {
	return !!response;
}

async function handleMainRoute(request: Request, env: Env): Promise<Response> {
	const { userUuid, message } = (await request.json()) as MainRouteRequest;

	if (!userUuid) {
		return new Response(JSON.stringify({ error: 'User UUID is required' }), { status: 400 });
	}

	if (!message) {
		return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
	}

	// Get user from database
	try {
		const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userUuid).first();
		if (!user) {
			return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
		}
	} catch (error) {
		console.error('Error:', error);
		return new Response(JSON.stringify({ error: 'An error occurred' }), {
			status: 500,
			headers: corsHeaders(),
		});
	}
	const client = new OpenAI({
		apiKey: env.OPENAI_API_KEY, // This is the default and can be omitted
	});
	try {
		const systemPrompt = `
    You will be given an action performed by the user. Respond with a valid JSON in the following format:

    {
      "action": "string",
      "subactions": [
        {"action": "string", "severity": int}
      ],
      "keywords": ["string"],
      "severity": int,
      "factor": int
    }

    • The “action” should be a concise summary of the action (preferably 4-5 words or less, maximum 10 words).
    • “subactions” are all the underlying actions and implications for people, the planet, ecology, customs, etc. Each sub-action should have a severity rating.
    • Severity rating: 0 = positive, 5 = neutral, 10 = very serious.
    • “keywords” should be a list of 10 words or proper nouns related to the action.
    • “severity” is the overall seriousness of the action (0 to 10).
    • “factor” is a metric to assess the impact of the action (1 = everyday task, 1000 = significant impact).

    If the language is not English, translate the action and respond in English.

    Example:

    Action: Eating a hamburger

    Response:

    {
      "action": "eating a hamburger",
      "subactions": [
        {"action": "tastes good", "severity": 2},
        {"action": "bad for health", "severity": 6},
        {"action": "supports intensive farming", "severity": 7},
        {"action": "promotes fast food industry", "severity": 5}
      ],
      "keywords": ["food", "health", "meat", "farming", "fast food", "nutrition", "ecology", "diet", "restaurant", "environment"],
      "severity": 6,
      "factor": 50
    }

    Remember to think about all the implications of the action in the subactions.
    Do not include any Markdown or other formatting in the response. Only provide the JSON output.
    `;
		const chatCompletion = await client.chat.completions.create({
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: message },
			],
			model: 'gpt-4o-mini',
		});
		const aiResponseRaw = chatCompletion.choices[0].message?.content;

		if (!aiResponseRaw) {
			console.log('Error:', chatCompletion);
			return new Response(JSON.stringify({ error: 'An error occurred while communicating with LLM (1)' }), {
				status: 500,
				headers: corsHeaders(),
			});
		}

		const aiResponse = JSON.parse(aiResponseRaw) as Action;
		const actionId = crypto.randomUUID();

		// if (!isOpenAiResponse(aiResponseJson)) {
		// 	return new Response(JSON.stringify({ error: 'Invalid response from LLM (2)', response: aiResponse }), {
		// 		status: 500,
		// 		headers: corsHeaders(),
		// 	});
		// }

		// save action to database with user_id
		try {
			await env.DB.prepare(
				'INSERT INTO actions (id, action, subactions, keywords, severity, factor, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);'
			)
				.bind(
					actionId,
					aiResponse.action,
					JSON.stringify(aiResponse.subactions),
					JSON.stringify(aiResponse.keywords),
					aiResponse.severity,
					aiResponse.factor,
					userUuid,
					new Date().toISOString()
				)
				.run();
		} catch (error) {
			console.error('Error:', error);
			return new Response(JSON.stringify({ error: 'An error occurred while saving the action' }), {
				status: 500,
				headers: corsHeaders(),
			});
		}

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

async function handleUserRoute(request: Request, env: Env): Promise<Response> {
	try {
		const { username } = (await request.json()) as UserRouteRequest;
		if (!username) {
			return new Response(JSON.stringify({ error: 'Username is required' }), { status: 400 });
		}
		const userUuid = crypto.randomUUID();
		await env.DB.prepare('INSERT INTO users (id, username) VALUES (?, ?);').bind(userUuid, username).run();
		return new Response(JSON.stringify({ userUuid }), {
			headers: { 'Content-Type': 'application/json', ...corsHeaders() },
		});
	} catch (error) {
		console.error('Error:', error);
		return new Response(JSON.stringify({ error: 'An error occurred' }), {
			status: 500,
			headers: corsHeaders(),
		});
	}
}

async function handleUserUUIDRoute(request: Request, uuid: string, env: Env): Promise<Response> {
	try {
		const result = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uuid).first();
		if (result) {
			//get the last 20 actions of the user
			const actions = await env.DB.prepare('SELECT * FROM actions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20;').bind(uuid).all();
			result.actions = actions;
			return new Response(JSON.stringify(result), {
				headers: { 'Content-Type': 'application/json', ...corsHeaders() },
			});
		} else {
			return new Response('User not found', { status: 404 });
		}
	} catch (error) {
		console.error('Error:', error);
		return new Response(JSON.stringify({ error: 'An error occurred' }), {
			status: 500,
			headers: corsHeaders(),
		});
	}
}

function handleOptions(request: Request): Response {
	return new Response(null, {
		status: 204,
		headers: {
			...corsHeaders(),
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '',
		},
	});
}

function corsHeaders(): HeadersInit {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	};
}
