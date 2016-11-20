PDFDocument.prototype.addContent = function(data) {
  (this._writeTarget || this.page).write(data);
  return this;
};
PDFDocument.prototype.createGroup = function() {
  let group = new (function PDFGroup() {})();
  group.name = 'G' + (this._groupCount = (this._groupCount || 0) + 1);
  group.closed = false;
  group.matrix = [1, 0, 0, 1, 0, 0];
  group.xobj = this.ref({
    Type: 'XObject', 
    Subtype: 'Form', 
    FormType: 1, 
    BBox: [-1000000, -1000000, 1000000, 1000000], 
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
  if (prevGroup) {prevGroup.matrix = this._ctm.slice();}
  if (nextGroup) {this._ctm = nextGroup.matrix.slice();}
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
  let name = 'M'+ (this._maskCount = (this._maskCount || 0) + 1);
  let gstate = this.ref({
    Type: 'ExtGState', CA: 1, ca: 1, BM: 'Normal',
    SMask: {S: 'Luminosity', G: group.xobj, BC: (clip ? [0,0,0] : [1,1,1])}
  });
  gstate.end();
  this.page.ext_gstates[name] = gstate;
  this.addContent("/" + name + " gs");
  return this;
};
