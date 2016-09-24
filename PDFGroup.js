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
  this._writeTarget = group.xobj;
  return(group);
};
PDFDocument.prototype.closeGroup = function(group) {
  this.page.xobjects[group.name] = group.xobj;
  group.xobj.end();
  group.closed = true;
  this._writeTarget = null;
  return(this);
};
PDFDocument.prototype.insertGroup = function(group) {
  if (!group.closed) {this.closeGroup(group);}
  this.addContent('/' + group.name + ' Do');
  return(this);
};
