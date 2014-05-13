function identity(d) { return d; }

var MS_PER_DAY = 1000 * 60 * 60 * 24;
function dateAdd(d, ms) {
  return new Date(d.getTime() + ms);
}

function daysBetween(d1, d2) {
  return (d2.getTime() - d1.getTime()) / MS_PER_DAY;
}

function Dimensions(o) {
  if (!(this instanceof Dimensions)) {
    throw Error("Use new Dimensions()");
  }
  if (o !== undefined) {
    for (var k in o) {
      this[k] = o[k];
    }
  }
}
Dimensions.prototype.radius = function() {
  return Math.min(this.width, this.height) / 2;
};
Dimensions.prototype.totalWidth = function() {
  return this.width + this.marginLeft + this.marginRight;
};
Dimensions.prototype.totalHeight = function() {
  return this.height + this.marginTop + this.marginBottom;
};
Dimensions.prototype.transformUpperLeft = function(e) {
  e.attr("transform", "translate(" + this.marginLeft + "," + this.marginTop + ")");
};
Dimensions.prototype.transformCenter = function(e) {
  e.attr("transform", "translate(" + (this.marginLeft + this.width / 2) + "," +
         (this.marginTop + this.height / 2) + ")");
};
Dimensions.prototype.setupSVG = function(e) {
  e.attr({
    width: this.totalWidth(),
    height: this.totalHeight()
  });
};
