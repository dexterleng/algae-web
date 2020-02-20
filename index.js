const express = require('express');
const path = require('path');
const fs = require('fs-extra')
const Queue = require('bull');

const EvaluationService = require("./evaluation_service");
const evalServiceConn = EvaluationService.createConnection();

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL;

const compareJobQueue = new Queue("comparison", REDIS_URL);

compareJobQueue.process(async (job, done) => {
	try {
		fs.emptyDirSync("./static/compare_results/");
		fs.rmdirSync("./static/compare_results/");

		console.log("Pulling algae image...");
		await EvaluationService.pullImage(evalServiceConn);
		console.log("Image pulled.");
		const container = await EvaluationService.createContainer(evalServiceConn);
		console.log("Container created.");
		await EvaluationService.moveToContainer(container, "./static/projects/", "/usr/src/app/projects/");
		console.log("Moved projects to container.");
		await EvaluationService.startContainerAndWait(container);
		console.log("Container has started");
		await EvaluationService.extractFromContainer(container, "/usr/src/app/compare_results/", "./static/");
		console.log("Comparison results have been extracted.");
		done(null, null);
	} catch (e) {
		done(e);
	}
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// set path for static assets
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
	res.render('index', { });
});

app.get('/summary', (req, res) => {
	const file_compare_summary = JSON.parse(fs.readFileSync("./static/compare_results/summary.json"));
	res.render('summary', { file_compare_summary });
});

app.get('/file_compare/:file_compare_filename', (req, res) => {
	const file_compare_path = `/static/compare_results/${req.params.file_compare_filename}`;
	const file_compare_file = JSON.parse(fs.readFileSync("." + file_compare_path, "utf8"));
	const file_a_name = file_compare_file.project_a_file.file_dir;
	const file_b_name = file_compare_file.project_b_file.file_dir;
	const file_a_path = path.join("/static/projects/", file_a_name);
	const file_b_path = path.join("/static/projects/", file_b_name);
	
	res.render('file_compare', { file_a_path, file_b_path, file_a_name, file_b_name, file_compare_path });
});

app.post('/start_compare', async (req, res) => {
	if (!fs.existsSync("./static/projects/")) {
		res.status(400).send();
		return;
	};

	const job = await compareJobQueue.add({});
	res.status(201).send(job);
});

app.get("/compare_progress/:jobID", async (req, res) => {
	const { jobID } = req.params;
	if (jobID === null || jobID === undefined) {
		res.status(400).send();
	};

	const job = await compareJobQueue.getJob(jobID);
	res.json(job);
});

app.listen(PORT, () => {
	console.log(`Server has started on port ${PORT}`);
});
