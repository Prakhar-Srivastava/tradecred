'use-strict';
const process = require('process');
const {format} = require('util');
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const {Storage} = require('@google-cloud/storage');
const XLSX = require('xlsx');
const crypto = require('crypto');
const {Datastore} = require('@google-cloud/datastore');

async function sheetBuffer2JSON(buf) {
	const wb = XLSX.read(buf, {cellDates: true}),
	data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

	let invoices = new Set();

	const valid = data.filter((row) => {
		const mustHaves = [
			'Invoice Numbers',
			'Net due dt',
			'Doc. Date',
			'Pstng Date',
			'Vendor Code',
			'Vendor name'
		]
		.reduce((last, el) => last && el in row && row[el] !== undefined, true),
		validDate = row['Pstng Date'].valueOf() <= Date.now(),
		seenAlready = invoices.has(row['Invoice Numbers']);

		if(!seenAlready)
			invoices.add(row['Invoice Numbers']);

		return !seenAlready && mustHaves && validDate;
	});

	return {
		invoicesInSheet: data.length,
		valid
	};
}

const storage = new Storage();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 500 * 1024 * 1024, //no larger than 500MB
	},
});
const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);
const {port = 8080} = process.env;
const app = express();
const datastore = new Datastore();

const save2DataStore = (data) => datastore.save({
	key: datastore.key(['Invoices', data['Invoice Numbers']]),
	data
});

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(bodyParser.json());

app.enable('trust proxy');

app.get('/', (_, res) => res.send('Yo'));


app.post('/', function(req, res) {
	const {invoices} = req.body;
	res.send({updateCount: invoices.length});
	invoices.forEach(el => save2DataStore(el));
});

app.post('/upload', upload.array('invoice_sheet'), (req, res, next) => {

	if(!req.files) {
		res.status(400).send('No file uploaded');
		return;
	}

	let file = req.files[0];// for(const file of req.files){
		sheetBuffer2JSON(file.buffer)
		.then((precis) => {

			const saveData = async () =>  {
				const data = precis.valid || [];
				data.forEach(el => save2DataStore(el));
			}

			saveData();

			if(!precis.valid.length)
				return;

			const blob = bucket.file(file.originalname);
			const blobStream = blob.createWriteStream({
				resumable: false,
			});

			blobStream.on('error', err => {
				next(err);
			});

			blobStream.on('finish', () => {
				const publicUrl = format(
				`https://storage.googleapis.com/${bucket.name}/${blob.name}`
				);
				res.status(200).send({
					sent: precis.invoicesInSheet,
					updated: precis.valid.length,
					file: publicUrl,
				});
			});

			blobStream.end(file.buffer);
		});
	// }
});

app.listen(port);
