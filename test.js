const SVGtoPDF = require('./source.js');

var fs = require('fs'),
  PDFDocument = require('pdfkit');

var doc = new PDFDocument(),
  stream = fs.createWriteStream('file.pdf'),
  svg = `<svg width="200" height="200" viewBox="0 0 200 200">
  <rect width="100%" height="100%" fill="green"/>
  
  <g width="100%" height="100%" transform-origin="50% 50%" transform="scale(0.5)" >
  
    <svg>
      <rect width="100%" height="100%" fill="red"/>
      <rect width="100%" height="100%" transform-origin="50% 50%" transform="scale(0.5)" fill="blue"/>
    </svg>
    
  </g>

</svg>`;

SVGtoPDF(doc, svg, 0, 0);

stream.on('finish', function () {
  console.log(fs.readFileSync('file.pdf'))
});

doc.pipe(stream);
doc.end();