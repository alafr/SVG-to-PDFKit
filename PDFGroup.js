PDFDocument.prototype.addContent = function(data) {
  (this._writeTarget || this.page).write(data);
  return(this);
};
PDFDocument.prototype.createGroup = function() {
  var PDFGroup = function() {};
  var group = new PDFGroup();
  group.name = 'G' + (this._groupCount = (this._groupCount || 0) + 1);
  group.closed = false;
  group.xobj = this.ref({
    Type: 'XObject', 
    Subtype: 'Form', 
    FormType: 1, 
    BBox: [0, 0, this.page.width, this.page.height], 
    Group: {S: 'Transparency', CS: 'DeviceRGB', I: false, K: false}
  });
  group.previousGroup = this._currentGroup;
  this._currentGroup = group;
  this._writeTarget = group.xobj;
  return(group);
};
PDFDocument.prototype.closeGroup = function(group) {
  this.page.xobjects[group.name] = group.xobj;
  group.xobj.end();
  group.closed = true;
  if (group.previousGroup && !group.previousGroup.closed) {
    this._currentGroup = group.previousGroup;
    this._writeTarget = group.previousGroup.xobj;
  } else {
    this._currentGroup = null;
    this._writeTarget = null;
  }
  return(this);
};
PDFDocument.prototype.insertGroup = function(group) {
  if (!group.closed) {this.closeGroup(group);}
  if (this.page.xobjects[group.name]) {
    this.addContent('/' + group.name + ' Do');
  }
  return(this);
};
PDFDocument.prototype.applyMask = function(group, clip) {
  if (!group.closed) {this.closeGroup(group);}
  var name = 'M'+ (this._maskCount = (this._maskCount || 0) + 1);
  var gstate = doc.ref({
    Type: 'ExtGState',
    CA: 1,
    ca: 1,
    BM: 'Normal',
    SMask: {S: 'Luminosity', G: group.xobj, BC: (clip ? [0,0,0] : [1,1,1])}
  });
  doc.page.ext_gstates[name] = gstate;
  gstate.end();
  doc.addContent("/" + name + " gs");
};
