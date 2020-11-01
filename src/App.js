import './App.css';
import XLSX from 'xlsx';
import {useState} from 'react';


const remote = true, 
	URL = remote ? 'https://scenic-crossbar-287116.el.r.appspot.com/' : 'http://localhost:8080/';

function readHandler({target}){

	alert("You file was short and is processed without the uplod");

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

	return fetch(URL, {
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
	})/*.then(resp => resp.json()
			.then(d => console.log(d))
			.catch(err => console.error(err))
	).catch(err => console.error(err));*/
}

function fileUploader(file) {
	let fd = new FormData();
	fd.append('invoice_sheet', file);
	return fetch(`${URL}upload`, {method: 'POST', body: fd})
	// .then(resp => resp.json()
	// 	.then((data) => console.log(data))
	// 	.catch((err) => console.error(err))
	// ).catch((err) => console.error(err));
}

function App() {

	const [data, setData] = useState(null);

	const handleUpload = (e) => {
		const {files} = e.target;
		
		if(files && files[0]){

			for(const file of files){
				if(file.size < 50 * 1024 * 1024) {
					const reader = new FileReader();
					reader.onloadend = (e) => {
						readHandler(e)
						.then((resp) => resp.json()
							.then((d) => setData(d))
							.catch((err) => console.error(err))
						).catch((err) => console.error(err));
					};
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
			<form>
				<input type="file" accept=".xls" onChange={handleUpload} name="invoice_sheet" />
				<input type="reset" />
			</form>
			{data ? JSON.stringify(data) : null}
		</div>
	);
}

export default App;
