import './App.css';
import XLSX from 'xlsx';
import moment from 'moment';


const remote = false, 
	URL = remote ? 'https://scenic-crossbar-287116.el.r.appspot.com/' : 'http://localhost:8080/';

function readHandler({target}){

	alert("You file was short and is processed without the uplod");

	const wb = XLSX.read(target.result, {type: "binary"}),
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
		validDate = moment(row['Pstng Date'], 'dd/mm/yyyy').unix() <= Date.now(),
		seenAlready = invoices.has(row['Invoice Numbers']);

		if(!seenAlready)
			invoices.add(row['Invoice Numbers']);
		
		return !seenAlready && mustHaves && validDate;
	});

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
			.then(d => console.log(d))
			.catch(err => console.error(err))
	).catch(err => console.error(err));
}

function App() {

	const handleUpload = (e) => {
		const {files} = e.target;
		
		if(files && files[0]){

			for(const file of files){
				const reader = new FileReader();
				reader.onloadend = readHandler;
				reader.readAsBinaryString(file);
			}
		}
	};

	return (
		<div className="App">
			<form runat="server" action={`${URL}upload`} encType="multipart/form-data" method="POST">
				<input type="file" multiple accept=".xls" onChange={handleUpload} name="invoice_sheet" />
				<input type="submit" />
			</form>
		</div>
	);
}

export default App;
