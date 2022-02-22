const SVGtoPDF = require('./source.js');

var fs = require('fs'),
  PDFDocument = require('pdfkit');

var doc = new PDFDocument(),
  stream = fs.createWriteStream('transformOriginTest.pdf'),
  svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <g id="target-g-1">
      <circle cx="100" cy="100" r="100" stroke="none"/>
      <line x1="100" y1="0" x2="100" y2="200" stroke="rebeccapurple" stroke-width="2"/>
      <line x1="0" y1="100" x2="200" y2="100" stroke="rebeccapurple" stroke-width="2"/>
    </g>
  </defs>

  <use href="#target-g-1" fill="black"/>
  <use href="#target-g-1" fill="blue"
      transform="scale(0.75 0.75)"
      transform-origin="100 100"/>

  <svg xmlns="http://www.w3.org/2000/svg" x="0" y="0" width="200" height="200" viewBox="0 0 200 200">
    <use href="#target-g-1" fill="red"
      transform="scale(0.5 0.5)"
      transform-origin="100 100"/>
    <use href="#target-g-1" fill="yellow"
      transform="scale(0.25 0.25)"
      transform-origin="100 100"/>
  </svg>
  </svg>
`;

SVGtoPDF(doc, svg, 0, 0);

doc.pipe(stream);
doc.end();