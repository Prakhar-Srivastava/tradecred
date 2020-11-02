import './App.css';
import XLSX from 'xlsx';
import {useState} from 'react';


const remote = true, 
	URL = remote ? 'https://scenic-crossbar-287116.el.r.appspot.com/' : 'http://localhost:8080/';

function readHandler({target}, callback){
	const wb = XLSX.read(target.result, {type: "binary", cellDates: true}),
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


	const amountSum = valid.reduce((last, el) => last + el['Amt in loc.cur.'], 0),
	vendors = (new Set(valid.map(el => el['Vendor Code']))).size;

	fetch(URL, {
		method: 'POST',
		mode: 'cors',
		cache: 'no-cache',
		credentials: 'same-origin',
		headers: {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*/*'
		},
		redirect: 'follow',
		referrerPolicy: 'no-referrer',
		body: JSON.stringify({invoices: valid})
	}).then(resp => resp.json()
			.then(d => callback({
				invoices: valid.length,
				amountSum,
				vendors,
				invalid: data.length -  valid.length,
				serverResponse: d
			}))
			.catch(err => console.error(err))
	).catch(err => console.error(err));

	alert("You file was < 50 MB so was processed locally");
}

function fileUploader(file) {
	let fd = new FormData();
	fd.append('invoice_sheet', file);
	return fetch(`${URL}upload`, {method: 'POST', body: fd})
}

function Info({
	invoices,
	amountSum,
	vendors,
	invalid
}) {
	return (
		<div className="info-container">
			<div className="pair">
				<div className="value">{invoices}</div>
				<div className="label">Invoices uploaded</div>
			</div>
			<div className="pair">
				<div className="value">{amountSum}</div>
				<div className="label">Total sum</div>
			</div>
			<div className="pair">
				<div className="value">{vendors}</div>
				<div className="label">Vendors updated</div>
			</div>
			<div className="pair">
				<div className="value" style={{color: 'red'}}>{invalid}</div>
				<div className="label" style={{color: 'red'}}>Invalid invoices</div>
			</div>
			
		</div>
	);
}

function App() {

	const [data, setData] = useState(null);

	const handleUpload = (e) => {
		const {files} = e.target;
		
		if(files && files[0]){

			for(const file of files){
				if(file.size < 50 * 1024 * 1024) {
					const reader = new FileReader();
					reader.onloadend = (e) => readHandler(e, setData);
					reader.readAsBinaryString(file);
				} else
					fileUploader(file)
					.then((resp) => resp.json()
						.then((d) => setData(d))
						.catch((err) => console.error(err))
					).catch((err) => console.error(err));
			}
		}
	};

	return (
		<div className="App">
			<h1 className="hero">Select your invoice sheet to upload data</h1>
			<form>
				<input type="file" accept=".xls" onChange={handleUpload} name="invoice_sheet" />
				<input type="reset" />
			</form>
			{data ? <Info {...data} /> : null}
		</div>
	);
}

export default App;
