const express = require('express');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// set path for static assets
app.use('/static', express.static(path.join(__dirname, 'static')));


app.get('/', (req, res) => {
	res.render('index', { });
});

app.get('/summary', (req, res) => {
	const file_compare_summary = JSON.parse(fs.readFileSync("./static/file_compare_results/summary.json"));
	res.render('summary', { file_compare_summary });
});

app.get('/file_compare/:file_compare_filename', (req, res) => {
	const file_compare_path = `/static/file_compare_results/${req.params.file_compare_filename}`;
	const file_compare_file = JSON.parse(fs.readFileSync("." + file_compare_path, "utf8"));
	const file_a_name = file_compare_file.project_a_file.file_dir;
	const file_b_name = file_compare_file.project_b_file.file_dir;
	const file_a_path = path.join("/static/projects/", file_a_name);
	const file_b_path = path.join("/static/projects/", file_b_name);
	
	res.render('file_compare', { file_a_path, file_b_path, file_a_name, file_b_name, file_compare_path });
});

app.listen(PORT, () => {
	console.log(`Server has started on port ${PORT}`);
});
