'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const mysql = require('mysql');
const uuid = require('uuid/v4');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const formidable = require('express-formidable');
const geocoder = require('node-geocoder')({
	provider: 'google',
	apiKey: 'AIzaSyDA2Q2pYWQRWvlxxvlvf_jT4lHVYcmKezo'
});
const app = express();

const db = mysql.createConnection({
	host: 'localhost',
	user: process.env.MYSQL_USERNAME,
	password: process.env.MYSQL_PASSWORD,
	database: 'Foodable'
});
db.connect(err => {
	if(err) {
		throw err;
	}

	console.log('Connected to MySQL.');

	setInterval(() => {
		// keep connection alive
		db.query('SELECT 1');
	}, 10 * 1000);
});

const transporter = nodemailer.createTransport({
	service: process.env.EMAIL_SERVICE,
	auth: {
		user: process.env.EMAIL_USERNAME,
		pass: process.env.EMAIL_PASSSWORD
	}
});

let accessTokens = [];

app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});

app.use(bodyParser.json());
app.use(cookieParser());

function verifyCookie(req) {
	try {
		let token = JSON.parse(req.cookies.accessToken);
		if(token) {
			token = token.token;
			if(token) {
				for(let accessToken of accessTokens) {
					if(accessToken.token === token) {
						let nextDate = new Date();
						nextDate.setMinutes(accessToken.created.getMinutes() + accessToken.expires);
						return accessToken;
					}
				}
			}
		}
	} catch(err) {
		return false;
	}

	return false;
}

app.get('/organizations/admin', (req, res, next) => {
	if(!verifyCookie(req)) {
		res.clearCookie('accessToken');
		res.redirect('/organizations/admin/login');
	} else {
		next();
	}
});

app.use('/', express.static(path.join(__dirname, 'www')));

app.post('/rest/locations/forOrganization', (req, res) => {
	let token = verifyCookie(req);
	if(!token) {
		res.clearCookie('accessToken');
		res.redirect('/organizations/admin/login');
	} else {
		db.query('SELECT * FROM locations WHERE orgName=?', [token.orgName], (err, results) => {
			if(err) {
				res.sendStatus(500);
				throw err;
			}

			let locations = [];
			for(let result of results) {
				let asMarker = {};
				for(let key in result) {
					asMarker[key] = result[key];
				}

				asMarker.position = {
					lat: parseFloat(asMarker.lat),
					lng: parseFloat(asMarker.lng)
				}
				delete asMarker.username;
				delete asMarker.passwordHash;
				delete asMarker.lat;
				delete asMarker.lng;

				locations.push(asMarker);
			}

			res.send(locations);
		});
	}
});
app.post('/rest/locations/add', (req, res) => {
	let token = verifyCookie(req);
	if(!token) {
		res.clearCookie('accessToken');
		res.redirect('/organizations/admin/login');
	} else {
		let { name, street, city, zip, url, foods, hours, phoneNumber, closures, eligibility, eligibilityUrl } = req.body;
		let orgName = token.orgName;
		let optimizedName = !name ? undefined : name.toLowerCase();

		let parameters = [null, name, orgName, street, city, zip, optimizedName, url, foods, hours, phoneNumber, closures, eligibility, eligibilityUrl];
		for(var par of parameters) {
			if(typeof par === 'undefined') {
				res.sendStatus(400);
				return;
			}
		}
		const place = street + ', ' + city + ' ' + zip;
		geocoder.geocode(place, (err, geo) => {
			if(err) {
				console.log("Error geocoding! Attempted geocoding: " + place);
				console.log(err.toString());
			} else {
				parameters.push(geo[0].latitude.toString());
				parameters.push(geo[0].longitude.toString());

				db.query('INSERT INTO locations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', parameters, (err, results) => {
					if(err) {
						res.sendStatus(500);
						throw err;
					}

					res.sendStatus(200);
				});
			}
		});
	}
});
app.post('/rest/locations/remove', (req, res) => {
	let token = verifyCookie(req)
	if(!token) {
		res.clearCookie('accessToken');
		res.redirect('/organizations/admin/login');
	} else {
		let { lat, lng } = req.body;

		if(typeof lat === 'undefined' || typeof lng === 'undefined') {
			res.sendStatus(400);
			return;
		}

		db.query('DELETE FROM locations WHERE lat=? AND lng=?', [lat.toString(), lng.toString()], (err, results) => {
			if(err) {
				res.sendStatus(500);
				throw err;
			}

			res.sendStatus(200);
		})
	}
});
app.get('/rest/organizations', (req, res) => {
	db.query('SELECT orgName FROM organizations', (err, results) => {
		if(err) {
			res.sendStatus(500);
			throw err;
		}

		res.send(results.map(x => x.orgName));
	});
});

app.post('/rest/organization/register', (req, res) => {
	let { username, password, orgName, email, orgUrl, about } = req.body;

	let parameters = [username, password, orgName, email, orgUrl, about];
	for(var par of parameters) {
		if(!par) {
			res.sendStatus(400);
			return;
		}
	}

	let text = 
		'An organization registered with Foodable.' + 
		'<br />Username: ' + username + 
		'<br />Password: ' + password + 
		'<br />Organization Name: ' + orgName +
		'<br />Contact Email: ' + email +
		'<br />Organization Website: ' + orgUrl +
		'<br />About:<br />' + about

	transporter.sendMail({
		from: 'titaniumsapphire32@gmail.com',
		to: 'titaniumsapphire32@gmail.com',
		priority: 'high',
		subject: 'Registration for Foodable: ' + orgName,
		html: text
	}, (error, info) => {
		if(error) {
			res.sendStatus(500);			
			console.log(error);
			throw error;
		}

		console.log('Sent email for new registration: ' + orgName);
		res.sendStatus(200);		
	});
});
app.use('/rest/organization/importCSV', formidable());
app.post('/rest/organization/importCSV', (req, res) => {
	let token = verifyCookie(req)
	if(!token) {
		res.clearCookie('accessToken');
		res.redirect('/organizations/admin/login');
	} else {
		let csv = fs.readFileSync(req.files.csv.path).toString().trim();
		let lines = csv.split('\n');

		let columnsLine = lines[0].trim();
		let columns = columnsLine.split(/,+(?=(?:(?:[^"]*"){2})*[^"]*$)/g).map(x => {
			x = x.trim();
			if(x.startsWith('"') && x.endsWith('"')) {
				x = x.substring(1, x.length - 1).trim();
			}
			return x;
		});

		let nameCol = columns.indexOf('name');
		let streetCol = columns.indexOf('street');
		let cityCol = columns.indexOf('city');
		let zipCol = columns.indexOf('zip');
		let urlCol = columns.indexOf('url');
		let foodsCol = columns.indexOf('foods');
		let hoursCol = columns.indexOf('hours');
		let phoneNumberCol = columns.indexOf('phoneNumber');
		let closuresCol = columns.indexOf('closures');
		let eligibilityCol = columns.indexOf('eligibility');
		let eligibilityUrlCol = columns.indexOf('eligibilityUrl');

		let array = [nameCol, streetCol, cityCol, zipCol, urlCol, foodsCol, phoneNumberCol, closuresCol, eligibilityCol, eligibilityUrlCol];
		for(let value of array) {
			if(typeof value === 'undefined') {
				res.sendStatus(400).send({
					line: 1
				});
				return;
			}
		}

		let endValues = [];
		for(let i = 1; i < lines.length; i++) {
			let line = lines[i].trim();
			let values = line.split(/,+(?=(?:(?:[^"]*"){2})*[^"]*$)/g).map(x => {
				x = x.trim();
				if(x.startsWith('"') && x.endsWith('"')) {
					x = x.substring(1, x.length - 1).trim();
				}
				return x;
			});

			let name = values[nameCol];
			let street = values[streetCol];
			let city = values[cityCol];
			let zip = values[zipCol];
			let url = values[urlCol];
			let foods = values[foodsCol];
			let hours = values[hoursCol];
			let phoneNumber = values[phoneNumberCol];
			let closures = values[closuresCol];
			let eligibility = values[eligibilityCol];
			let eligibilityUrl = values[eligibilityUrlCol];

			if(eligibility === '' || eligibility === 'none') {
				eligibility = 'none';
				eligibilityUrl = null;
			}

			let orgName = token.orgName;
			let optimizedName = !name ? undefined : name.toLowerCase();

			let parameters = [null, name, orgName, street, city, zip, optimizedName, url, foods, hours, phoneNumber, closures, eligibility, eligibilityUrl];
			for(var par of parameters) {
				if(typeof par === 'undefined') {
					res.status(400).send({
						line: i + 1
					});
					return;
				}
			}

			endValues.push(parameters);
		}

		for(let parameters of endValues) {
			const place = parameters[3] + ', ' + parameters[4] + ' ' + parameters[5];
			geocoder.geocode(place, (err, geo) => {
				if(err) {
					console.log("Error geocoding! Attempted geocoding: " + place);
					console.log(err.toString());
				} else {
					parameters.push(geo[0].latitude.toString());
					parameters.push(geo[0].longitude.toString());

					db.query('INSERT INTO locations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', parameters, (err, results) => {
						if(err) {
							if(!res.headersSent) {
								res.sendStatus(500);
							}
							throw err;
						}
					});
				}
			});
		}

		res.sendStatus(200);		
	}
});
app.post('/rest/organization/url', (req, res) => {
	let token = verifyCookie(req)
	if(!token) {
		res.clearCookie('accessToken');
		res.redirect('/organizations/admin/login');
	} else {
		let url = req.body.url;
		if(typeof url === 'undefined') {
			res.send(400);
		} else {
			db.query('UPDATE organizations SET orgUrl=? WHERE orgName=?', [url, token.orgName], (err, results) => {
				if(err) {
					res.sendStatus(500);
					throw err;
				}

				res.sendStatus(200);
			});
		}
	}
});
app.post('/rest/organization/image', (req, res) => {
	let token = verifyCookie(req)
	if(!token) {
		res.clearCookie('accessToken');
		res.redirect('/organizations/admin/login');
	} else {
		let url = req.body.url;
		if(typeof url === 'undefined') {
			res.send(400);
		} else {
			db.query('UPDATE organizations SET orgImage=? WHERE orgName=?', [url, token.orgName], (err, results) => {
				if(err) {
					res.sendStatus(500);
					throw err;
				}

				res.sendStatus(200);
			});
		}
	}
});

app.post('/rest/organization/invalidate', (req, res) => {
	let token = verifyCookie(req)
	if(!token) {
		res.clearCookie('accessToken');
		res.redirect('/organizations/admin/login');
	} else {
		for(let accessToken of accessTokens) {
			if(accessToken.token == token.token) {
				accessTokens.splice(accessTokens.indexOf(accessToken), 1);

				res.clearCookie('accessToken');
				res.sendStatus(200);

				break;
			}
		}
	}
});
app.post('/rest/organization/verify', (req, res) => {
	db.query('SELECT * FROM organizations WHERE username=? AND passwordHash=sha2(?, 256)', [req.body.username, req.body.password], (err, results) => {
		if(err) {
			res.sendStatus(500);
			throw err;
		}

		if(results.length === 0) {
			res.send({
				success: false
			});
		} else {
			let token = {
				token: uuid(),
				expires: 180,
				created: new Date(),
				orgName: results[0].orgName,
				orgUrl: results[0].orgUrl,
				orgImage: results[0].orgImage
			};
			accessTokens.push(token);
			res.cookie('accessToken', JSON.stringify(token));
			res.send({
				success: true
			});

			setTimeout(() => {
				let idx = accessTokens.indexOf(token);
				if(idx !== -1) {
					accessTokens.splice(idx, 1);
				}
			}, token.expires * 60 * 1000);
		}
	});
});
app.get('/rest/locations', (req, res) => {
	let inputLat = req.query.lat;
	let inputLng = req.query.lng;
	let radius = req.query.radius;

	if(!inputLat || !inputLng || !radius) {
		res.sendStatus(400);
		return;
	}
	try {
		inputLat = parseFloat(inputLat);
		inputLng = parseFloat(inputLng);
		radius = parseInt(radius);
	} catch(err) {
		res.sendStatus(400);
		return;
	}

	const inputLatRadians = inputLat * Math.PI / 180;
	const inputLngRadians = inputLng * Math.PI / 180;

	db.query('SELECT * FROM locations RIGHT JOIN organizations ON locations.orgName=organizations.orgName', (err, results) => {
		if(err) {
			res.sendStatus(500);
			throw err;
		}
		
		let locations = [];
		results.forEach(result => {
			const testLat = parseFloat(result.lat);
			const testLng = parseFloat(result.lng);
		
			const testLatRadians = testLat * Math.PI / 180;
			const testLngRadians = testLng * Math.PI / 180;
			let distance = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((inputLatRadians - testLatRadians) / 2), 2) + Math.cos(inputLatRadians) * Math.cos(testLatRadians) * Math.pow(Math.sin((inputLngRadians - testLngRadians) / 2), 2)));
			distance *= 6378137; // factor in Earth's radius
			distance /= 1609.34; // convert from meters to miles
			
			if(distance <= radius) {
				let asMarker = {};
				for(let key in result) {
					asMarker[key] = result[key];
				}

				asMarker.position = {
					lat: parseFloat(asMarker.lat),
					lng: parseFloat(asMarker.lng)
				}
				delete asMarker.username;
				delete asMarker.passwordHash;
				delete asMarker.lat;
				delete asMarker.lng;

				locations.push(asMarker);
			}
		});

		res.send(locations);
	});
});
app.get('*', (req, res) => {
	if(!res.headersSent) {
		res.redirect('https://' + req.hostname + '/');
	}
});

let options = {
	key: fs.readFileSync(process.env.PRIVKEY_PATH),
	cert: fs.readFileSync(process.env.CERT_PATH)
};

https.createServer(options, app).listen(443, () => {
	console.log('Started server.');
});

const http = express();
http.get('*', (req, res) => {
	res.redirect('https://' + req.hostname + req.url);
});
http.listen(80, () => {
	console.log('Started HTTP redirect server.');
});