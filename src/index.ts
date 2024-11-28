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
{/** 
app.post('/textToImage', async (c) => {
	try {
	  // 1. Parse the incoming JSON request to extract the document title
	  const { documentTitle } = await c.req.json();
	  console.log(documentTitle);
  
	  // 2. Define the input for the Dreamshaper model with the document title as a prompt
	  const inputs = {
		prompt: `Create an image based on the following text: "${documentTitle}"`,
	  };
  
	  // 3. Run the Cloudflare AI Dreamshaper model with the inputs
	  const textResponse = await c.env.AI.run('@cf/lykon/dreamshaper-8-lcm', inputs);
	  console.log(textResponse);
  
	  // 4. Check if the response contains the image data
	  if (textResponse ) {
		// Assuming the AI model returns binary image data, handle it accordingly
		return new Response(textResponse, {
		  status: 200,
		  headers: {
			'Content-Type': 'image/jpg', // or image/png, based on the model output
		  },
		});
	  } else {
		return new Response(
		  JSON.stringify({ error: 'Failed to generate image' }),
		  { status: 500 }
		);
	  }
	} catch (error) {
	  console.error('Error in textToImage function:', error);
	  return new Response(
		JSON.stringify({ error: 'Internal Server Error' }),
		{ status: 500 }
	  );
	}
  });*/}






app.post('/generateImageForDoc', async (c) => {
  const { docId, title } = await c.req.json();

  if (!docId || !title) {
    return c.json({ error: 'docId and title are required' }, 400);
  }

  try {
    // Initialize OpenAI API
    const openai = new OpenAI({
      apiKey: c.env.OPEN_AI_KEY, // Ensure you are using the correct environment variable for your OpenAI key
    });

    // Generate image using OpenAI's DALL-E model
    const imageResponse = await openai.images.generate({
      prompt: `Create an image based on the title: "${title}"`,
      n: 1,
      size: '512x512',
    });

   
	console.log('Image Response:', imageResponse);
	if (imageResponse?.data && imageResponse.data[0]?.url) {
		const imageUrl = imageResponse.data[0].url;
		console.log('Generated Image URL:', imageUrl); // Log the image URL
		return c.json({ imageUrl });
	  } else {
		return c.json({ error: 'Failed to generate image: No URL in response' }, 500);
	  }
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to generate image' }, 500);
  }
});

export default app;
