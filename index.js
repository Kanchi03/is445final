const express = require('express');
const multer = require('multer');
const fs = require('fs');
const readline = require('readline');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Show import page
app.get('/import', (req, res) => {
  res.render('import');
});

// Handle file upload & process data
app.post('/upload', upload.array('file', 2), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send('Error: No files uploaded.');
    }

    for (const file of req.files) {
      await processFile(file.path);
    }

    res.send('Files processed successfully!');
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Server error. Please try again.');
  }
});

// Function to process TXT files & insert into PostgreSQL
async function processFile(filename) {
  const fileStream = fs.createReadStream(filename);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const values = line.split(',');

    const sql = `
      INSERT INTO evehicle 
      (vid, vin, city, postal_code, model_year, make, model, ev_type, electric_range, base_msrp, purchase_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);
    `;

    const formattedValues = values.map(v => v.trim() === 'Null' ? null : v.trim());

    try {
      await pool.query(sql, formattedValues);
      console.log(`Inserted record: ${formattedValues}`);
    } catch (error) {
      console.error(`Error inserting record ${values[0]}: ${error.message}`);
    }
  }

  console.log(`Finished processing file: ${filename}`);
}

// Home page route
app.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM evehicle ORDER BY vid');
    res.render('index', { vehicles: rows });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).send('Server error. Please try again later.');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
