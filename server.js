import { Telegraf } from 'telegraf';
import UserModel from './src/models/User.js';
import EventModel from './src/models/Event.js'; 
import { config } from 'dotenv';
import connectDB from './config/db.js';
import { message } from 'telegraf/filters';
import { GoogleGenerativeAI }from '@google/generative-ai'

config();


const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const bot = new Telegraf(process.env.TELEGRAM_BOT_API);

try {
    connectDB();
} catch (error) {
    console.error(error);
    process.kill(process.pid, 'SIGTERM');
}

bot.start(async (ctx) => {
    const from = ctx.update.message.from;
    try {
        await UserModel.findOneAndUpdate(
            { tgId: from.id },
            {
                $setOnInsert: {
                    firstName: from.first_name,
                    lastName: from.last_name,  
                    isBot: from.is_bot,
                    username: from.username,
                },
            },
            { upsert: true, new: true }
        );
        await ctx.reply('Welcome to extromedia');
    } catch (error) {
        console.error(error);
        await ctx.reply('An error occurred');
    }
});

bot.command('generate', async (ctx) => {
    const from = ctx.update.message.from;

    const startofDay = new Date();
    startofDay.setHours(0, 0, 0, 0);

    const endofDay = new Date();
    endofDay.setHours(23, 59, 59, 999);

    try {
        const events = await EventModel.find({ 
            tgId: from.id,
            createdAt: {
                $gte: startofDay,
                $lte: endofDay,
            },
        });

        if (events.length === 0) {
            await ctx.reply("No events found");
        } 
        await ctx.reply("Events found and noted");
        
    } catch (error) {
        console.error(error);
        await ctx.reply("An error occurred while fetching events");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
        const chat = model.startChat({
            history: [
              {
                role: "user",
                parts: [{ text: "Hello, I have 2 dogs in my house." }],
              },
              {
                role: "model",
                parts: [{ text: "Great to meet you. What would you like to know?" }],
              },
            ],
            generationConfig: {
              maxOutputTokens: 100,
            },
          });
         const response = await chat.sendMessage();
        await ctx.reply(response.data.choices[0].message.text);
    


        
    } catch (error) {
        console.error(error);   
    }

});

bot.on(message('text'), async (ctx) => {
    const from = ctx.update.message.from;
    const message = ctx.update.message.text;
    try {
        await EventModel.create({
            text: message,
            tgId: from.id,
        });
        await ctx.reply("Got the message and noted");
    } catch (error) {
        console.error(error);
        await ctx.reply("An error occurred while saving the message");
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
