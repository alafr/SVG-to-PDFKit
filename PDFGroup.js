function multiplyMatrix(a, b) {
  return [ a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
           a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5] ];
}
PDFDocument.prototype.addContent = function(data) {
  (this._writeTarget || this.page).write(data);
  return this;
};
PDFDocument.prototype.createGroup = function(bbox) {
  let group = new (function PDFGroup() {})();
  group.name = 'G' + (this._groupCount = (this._groupCount || 0) + 1);
  group.closed = false;
  group.matrix = [1, 0, 0, 1, 0, 0];
  group.xobj = this.ref({
    Type: 'XObject', 
    Subtype: 'Form', 
    FormType: 1, 
    BBox: bbox || [-1000000, -1000000, 1000000, 1000000], 
    Group: {S: 'Transparency', CS: 'DeviceRGB', I: true, K: false}
  });
  group.previousGroup = this._currentGroup;
  this.writeToGroup(group);
  return group;
};
PDFDocument.prototype.writeToGroup = function(group) {
  let prevGroup = this._currentGroup,
      nextGroup = group && (!group.closed) && group || null;
  if (nextGroup) {
    this._currentGroup = nextGroup;
    this._writeTarget = nextGroup.xobj;
  } else {
    this._currentGroup = null;
    this._writeTarget = null;
  }
  (prevGroup || this).matrix = this._ctm;
  this._ctm = (nextGroup || this).matrix;
  return this;
};
PDFDocument.prototype.closeGroup = function(group) {
  this.page.xobjects[group.name] = group.xobj;
  group.xobj.end();
  group.closed = true;
  this.writeToGroup(group.previousGroup);
  return this;
};
PDFDocument.prototype.insertGroup = function(group) {
  if (!group.closed) {this.closeGroup(group);}
  this.addContent('/' + group.name + ' Do');
  return this;
};
PDFDocument.prototype.applyMask = function(group, clip) {
  if (!group.closed) {this.closeGroup(group);}
  let name = 'M' + (this._maskCount = (this._maskCount || 0) + 1);
  let gstate = this.ref({
    Type: 'ExtGState', CA: 1, ca: 1, BM: 'Normal',
    SMask: {S: 'Luminosity', G: group.xobj, BC: (clip ? [0,0,0] : [1,1,1])}
  });
  gstate.end();
  this.page.ext_gstates[name] = gstate;
  this.addContent('/' + name + ' gs');
  return this;
};
PDFDocument.prototype.makePattern = function(group, dx, dy, matrix) {
  if (!group.closed) {this.closeGroup(group);}
  let pattern = new (function PDFPattern() {})();
  pattern.name = 'P' + (this._patternCount = (this._patternCount || 0) + 1);
  pattern.ref = this.ref({
    Type: 'Pattern', PatternType: 1, PaintType: 1, TilingType: 2,
    BBox: [0, 0, dx, dy], XStep: dx, YStep: dy,
    Matrix: matrix ? multiplyMatrix(this._ctm, matrix) : this._ctm,
    Resources: {
      ProcSet: ['PDF', 'Text', 'ImageB', 'ImageC', 'ImageI'],
      XObject: {[group.name]: group.xobj}
    }
  });
  pattern.ref.write('/' + group.name + ' Do');
  pattern.ref.end();
  return pattern;
};
PDFDocument.prototype.setPatternFill = function(group, dx, dy, matrix) {
  let pattern = this.makePattern(group, dx, dy, matrix);
  this.page.patterns[pattern.name] = pattern.ref;
  this.addContent('/Pattern cs');
  this.addContent('/' + pattern.name + ' scn');
  return this;
};
PDFDocument.prototype.setPatternStroke = function(group, dx, dy, matrix) {
  let pattern = this.makePattern(group, dx, dy, matrix);
  this.page.patterns[pattern.name] = pattern.ref;
  this.addContent('/Pattern cs');
  this.addContent('/' + pattern.name + ' SCN');
  return this;
};
