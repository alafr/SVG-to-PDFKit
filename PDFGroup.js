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
    Group: {S: 'Transparency', CS: 'DeviceRGB', I: true, K: false}
  });
  group.previousGroup = this._currentGroup;
  this.writeToGroup(group);
  return(group);
};
PDFDocument.prototype.writeToGroup = function(group) {
  if (group && !group.closed) {
    this._currentGroup = group;
    this._writeTarget = group.xobj;
  } else {
    this._currentGroup = null;
    this._writeTarget = null;
  }
  return(this);
};
PDFDocument.prototype.closeGroup = function(group) {
  this.page.xobjects[group.name] = group.xobj;
  group.xobj.end();
  group.closed = true;
  this.writeToGroup(group.previousGroup);
  return(this);
};
PDFDocument.prototype.insertGroup = function(group) {
  if (!group.closed) {this.closeGroup(group);}
  this.addContent('/' + group.name + ' Do');
  return(this);
};
PDFDocument.prototype.applyMask = function(group, clip) {
  if (!group.closed) {this.closeGroup(group);}
  var name = 'M'+ (this._maskCount = (this._maskCount || 0) + 1);
  var gstate = this.ref({
    Type: 'ExtGState', CA: 1, ca: 1, BM: 'Normal',
    SMask: {S: 'Luminosity', G: group.xobj, BC: (clip ? [0,0,0] : [1,1,1])}
  });
  this.page.ext_gstates[name] = gstate;
  gstate.end();
  this.addContent("/" + name + " gs");
  return(this);
};
