require('dotenv').config()
const superagent = require('superagent')
const moment = require('moment')
const TelegramBot = require('node-telegram-bot-api')
const TELEGRAM_BOT_TOKEN = '975319882:AAEUhxZo08FbquS-TUi39CcTCLQ0jVp5gd8'
const GOOGLE_MAPS_TOKEN = 'AIzaSyCaK8qoLfQ8WW7M4XGe60O1_LpVrBE6yyk'
const options = {
}

const url = 't.me/vayumalinyabot'
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: true})

const limits = {
	o2: {low: 10, high: 25, unit: 'µg/m³'},
	pm25: {low: 10, high: 25, unit: 'µg/m³'},
	pm10: {low: 20, high: 50, unit: 'µg/m³'},
	o3: {low: 100, high: 300, unit: 'µg/m³'},
	no2: {low: 40, high: 200, unit: 'µg/m³'},
	so2: {low: 20, high: 400, unit: 'µg/m³'},
	co: {low: 9999, high: 9999, unit: 'µg/m³'}
}

const commands = {
	hi(params){
        sendMessage('Hi, Hope you are staying safe')
	},
    start(params) {
        sendMessage('Hi')
        sendMessage(`Send me your location or the name of a place you want to know about.`)
    },
    help(params) {
        sendMessage('If you send me your current location, I\'ll send you the air quality of your area. Data comes from https://openaq.org/, a platform for open air quality data. Recommended levels taken from WHO guideline http://www.who.int/. \n\n Please also try the other commands as well /start /owner')
    },
    owner(params) {
        sendMessage('Built with lots of ♥  by Gopa Vasanth ❣️')
    }
}

function processCommand(entity) {
	let cmd = message.text.substr(entity.offset + 1, entity.length - 1)
	let params = message.text.substr(entity.offset + entity.length + 1)
	try {
		commands[cmd](params)
	} catch (error) {
		console.error(error)
		sendMessage(`I didn't quite get that. Could you rephrase?`)
	}
}

function sendMessage(msg, options) {
	options = {
		parse_mode: 'Markdown',
		reply_markup: { remove_keyboard: true },
		...options,
	}
	console.log("Response: ", msg)
	bot.sendMessage(message.chat.id, msg, options)
}

function getMeasurements(location, radius = 25000) {
	return superagent.get(`https://api.openaq.org/v1/latest?coordinates=${location.latitude},${location.longitude}&radius=${radius}`).then((res) => {
		return res.body.results.filter((location) => {
			return location.measurements && location.measurements.find((mes) => new Date(mes.lastUpdated) > moment().subtract(1, 'days'))
		})
	})
}

function sendMeasurements(results, msg) {
    if(results.length < 1) return sendMessage(`Sorry, I didn't find any data for your area...`)
    else {
        let measurements = results.sort((l1, l2) => l1.distance - l2.distance).reduce((result, location) => {
            location.measurements.filter((param) => new Date(param.lastUpdated) > moment().subtract(3, 'days')).map((param) => {
                if(result[param.parameter]) return
                result[param.parameter] = { ...param, distance: Math.round(location.distance / 10) / 100 };
            })
            return result
        }, {})
      let text = (`This is the current stats of your area !\n` )
        for(let param in measurements) {
            text += `*${param}* ${Math.round(measurements[param].value * 100) / 100} ${measurements[param].unit} `
            if(limits[param] && limits[param].unit === measurements[param].unit) {
                text += measurements[param].value > limits[param].high ? '😫 ' : measurements[param].value > limits[param].low ? '😐 ' : '🙂 '
            }
            text += `_(${new Date(measurements[param].lastUpdated).toLocaleString()} in 2.5 km radius)_`
        }
      text += "\n\n Hope you will take all the required measures to control this pollution 😃" 
        sendMessage(text)
    }
}

function sendAnswer(location) {
	getMeasurements(location).then((res) => {
		sendMeasurements(res)
	}, (err) => {
		console.log(err)
		sendMessage(`My data dealer seems to have problems. Please try again later.`)
	})
}

let message;
bot.on('text', function onMessage(msg) {
	console.log('Sending message to',msg.from.first_name, msg.from.last_name, ", Username: ", msg.from.username)
	console.log('Request: ', msg.text)
	message = msg;
	bot.sendChatAction(msg.chat.id, 'typing')
	if(message.entities && (cmds = message.entities.filter((e) => e.type === 'bot_command')).length > 0) {
		cmds.map((entity) => processCommand(entity))
	} else {
		superagent.get(`https://maps.googleapis.com/maps/api/geocode/json?&address=${encodeURIComponent(message.text)}&key=${GOOGLE_MAPS_TOKEN}`).then((res) => {
			if(res.body.results.length < 1) return sendMessage(`I didn't find that address. Could you rephrase?`)
			let location = res.body.results.pop()
			sendAnswer({latitude: (location.geometry.location.lat).toFixed(3), longitude: (location.geometry.location.lng).toFixed(3)})
		})
	}
});

bot.on('location', (msg) => {
	message = msg
	bot.sendChatAction(msg.chat.id, 'typing')
	sendAnswer(msg.location)
})