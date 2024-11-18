/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 
 */




import OpenAI from "openai";
import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
	OPEN_AI_KEY: string;
	AI: Ai; // this is from wrangler.toml
}

//bindings-very impo in cloudflare- they essentially resemble env. variables that we have access to
//they are called bindings not only because they have environment varisbles but its also these powerful AI bindings and other things
const app = new Hono<{Bindings: Bindings}>();

//cors
app.use(
	'/*', //this means to all of the roots inside the app
	cors({
		origin: '*', //to allow all requests from next.js app
		allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests','Content-Type'], //adding content type to the allowed headers to fix CORS
		//we are going to make content type request to our backend.
		allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT'],
		exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
		maxAge: 600,
		credentials: true,
	})

);
app.get('/', (c) => {
    return new Response('Worker is running!');
});
/** 
app.post('/translateDocument', (c) => {
    return new Response('Translate Document Route Working!');
});
*/




//1st API endpoint:

//cludflare translation. 
   //c is context
app.post('/translateDocument', async (c) =>{
	//1. when we make a request from  our next.js app, we r gng to pass the document data and the target language.
	//the document datat is going to be the blocknote info. from the editor.
	const { documentData, targetLang } = await c.req.json();
	
	
	//2. then we r gng to generate summary of the document.
	const summaryResponse = await c.env.AI.run('@cf/facebook/bart-large-cnn',{
		input_text: documentData,
		max_length: 1000,
	});

	//3. translate the summary into another language
	const response = await c.env.AI.run('@cf/meta/m2m100-1.2b',{
		text: summaryResponse.summary,
		source_lang: 'english',
		target_lang: targetLang,
	})

    

	return new Response(JSON.stringify(response));

});

app.post('/chatToDocument', async(c) => {
	const openai = new OpenAI({
		apiKey: c.env.OPEN_AI_KEY,
	});

	const { documentData, question } = await c.req.json();

	//we pass json from blocknote
	const chatCompletion = await openai.chat.completions.create({
		messages: [
			{
				role: 'system',
				content:'You are a assistant helping the user to chat to a document, I am providing a JSON file of the markdown for the document. Using this, answer the users question in the clearest way possible, the document is about '+
				documentData,

			},
			{
				role: 'user',
				content: 'My Question is: '+ question,
			},

		], 
		model: "gpt-3.5-turbo",
		temperature: 0.5,
	});
    
	const response = chatCompletion.choices[0].message.content;
	return c.json({message: response});
});


export default app;
