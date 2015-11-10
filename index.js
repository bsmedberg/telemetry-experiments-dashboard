var DATA_BASE = "https://analysis-output.telemetry.mozilla.org/experiments/data/experiments__DATE__-__CHANNEL__.json.gz";

var gStartDate, gEndDate;
var gChannel;
var gData;

var gDateFormat = d3.time.format.utc("%Y%m%d");
var gPrettyDate = d3.time.format.utc("%Y-%m-%d");
var gPctFormat = d3.format("%");

function valueToDate(v, defaultDelta) {
  if (v == "") {
    return dateAdd(new Date(), defaultDelta * MS_PER_DAY);
  }
  return new Date(v);
}

function dateIsValid(d) {
  if (isNaN(d.getTime())) {
    return false;
  }
  if (new Date("2014-04-01") > d ||
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 2) < d) {
    return false;
  }
  return true;
}

function initAndFetch() {
  gChannel = d3.select('input[name="channel"]:checked').property("value");
  d3.select("#channelHead").text(gChannel + " channel");

  gData = d3.map();

  var startDate = valueToDate(d3.select("#startDate").property("value"), -1);
  if (!dateIsValid(startDate)) {
    d3.select("#parsedStartDate").text("Invalid!").style("color", "red");
    return;
  }
  gStartDate = gDateFormat(startDate);
  d3.select("#parsedStartDate").text(gPrettyDate(startDate));

  var endDate = valueToDate(d3.select("#endDate").property("value"), -15);
  if (!dateIsValid(endDate)) {
    d3.select("#parsedEndDate").text("Invalid!").style("color", "red");
    return;
  }
  gEndDate = gDateFormat(endDate),
  d3.select("#parsedEndDate").text(gPrettyDate(endDate));

  fetchDates();
}

function iterDates() {
  var r = [];

  var d = gDateFormat.parse(gStartDate);
  var endDate = gDateFormat.parse(gEndDate);
  while (d >= endDate) {
    r.push(gDateFormat(d));
    d = dateAdd(d,  -MS_PER_DAY);
  }
  return r;
}

function fetchDates() {
  iterDates().forEach(function(d) {
    if (gData.has(d)) {
      return;
    }
    var url = DATA_BASE.replace("__DATE__", d).replace("__CHANNEL__", gChannel);
    d3.json(url, function(data) {
      gData.set(d, data);
      doGraph();
    });
  });
}

function setupInstallRatio(eid, section) {
  var data = iterDates().filter(function(d) { return gData.get(d); })
    .map(function(d) {
      var day = gData.get(d);
      var c = 0;
      if (eid in day.experiments) {
        var active = day.experiments[eid].active;
        if ((typeof active) == "number") {
          // old-style data just counted .active
          c += active;
        } else {
          // new-style data has branches
          Object.keys(active).forEach(function(branch) {
            c += active[branch];
          });
        }
      }
      return {
        date: gDateFormat.parse(d),
        datestr: d,
        c: c,
        total: day.total
      };
    });

  var maxPct = d3.max(data, function(d) { return d.c / d.total; });
  if (maxPct == 0) {
    section.select(".installRatioContainer").style("display", "none");
    return;
  }
  section.select(".installRatioContainer").style("display", "block");

  var dims = new Dimensions({
    height: 120,
    width: 15 * daysBetween(gDateFormat.parse(gEndDate), gDateFormat.parse(gStartDate)),
    marginTop: 10,
    marginLeft: 85,
    marginRight: 10,
    marginBottom: 135
  });

  var xscale = d3.time.scale()
    .range([0, dims.width])
    .domain([gDateFormat.parse(gEndDate), gDateFormat.parse(gStartDate)]);
  var yscale = d3.scale.linear()
    .range([0, dims.height])
    .domain([maxPct, 0]);

  var xaxis = d3.svg.axis()
    .scale(xscale)
    .orient("bottom")
    .tickFormat(gDateFormat);
  var yaxis = d3.svg.axis()
    .scale(yscale)
    .orient("left")
    .tickFormat(d3.format(".2p"))
    .ticks(5);

  var svgg = section.select(".installRatio").text('')
    .call(function(d) { dims.setupSVG(d); })
    .append("g")
    .call(function(d) { dims.transformUpperLeft(d); });
  svgg.append("g")
    .attr({
      "class": "x axis",
      "transform": "translate(0," + dims.height + ")"
    })
    .call(xaxis)
    .selectAll("text")
    .attr({
      y: 0,
      x: -9,
      dy: "0.35em",
      transform: "rotate(-90)"
    })
    .style("text-anchor", "end");
  svgg.append("g")
    .attr("class", "y axis")
    .call(yaxis);

  svgg.selectAll(".point")
    .data(data)
    .enter().append("circle")
    .attr({
      "class": "point",
      "cx": function(d) { return xscale(d.date); },
      "cy": function(d) { return yscale(d.c / d.total); },
      "r": 3,
      "fill": "black",
      "title": function(d) { return "Date: " + d.datestr + " Count: " + d.c + " Total: " + d.total + " (" + d3.format(".2p")(d.c / d.total) + ")"; }
    });
}

function setupBranches(eid, section) {
  var data = d3.map();
  function acc(key, v) {
    data.set(key, (data.get(key) || 0) + v);
  }
  iterDates().forEach(function(d) {
    var day = gData.get(d);
    if (!day) {
      return;
    }
    if (eid in day.experiments) {
      var active = day.experiments[eid].active;
      if ((typeof active) == "number") {
        acc("unknown", active);
      } else {
        Object.keys(active).forEach(function(branch) {
          acc(branch, active[branch]);
        });
      }
    }
  });

  data = data.entries();
  data.sort(function(a, b) { return d3.descending(a.value, b.value); });

  var total = d3.sum(data, function(d) { return d.value; });

  var branchRows = section.select(".branchTable tbody").text("")
    .selectAll("tr").data(data).enter().append("tr");
  branchRows.append("td").text(function(d) { return d.key || "unset"; });
  branchRows.append("td").text(function(d) { return d.value; });
  branchRows.append("td").text(function(d) { return gPctFormat(d.value / total); });
}

function setupActivations(eid, section) {
  var activations = [];
  var rejections = d3.map();
  iterDates().forEach(function(datestr) {
    var day = gData.get(datestr);
    if (!day) {
      return;
    }
    if (!(eid in day.experiments)) {
      return;
    }
    day.experiments[eid].activations.forEach(function (d) {
      var key = d[0];
      if (key.length == 1 && key[0] == "ACTIVATED") {
        activations.push({ datestr: datestr, count: d[1] });
        return;
      }

      var keystr = d[0].join(',');
      if (!rejections.has(keystr)) {
        rejections.set(keystr, { key: key, count: 0 });
      }
      rejections.get(keystr).count += d[1];
    });
  });

  var activateRows = section.select(".activationTable tbody").text("")
    .selectAll("tr").data(activations).enter().append("tr");
  activateRows.append("td").text(function(d) { return d.datestr; });
  activateRows.append("td").text(function(d) { return d.count; });

  rejections = rejections.values();
  rejections.sort(function(a, b) { return d3.descending(a.count, b.count); });

  var rejectRows = section.select(".failedTable tbody").text("")
    .selectAll("tr").data(rejections).enter().append("tr");
  rejectRows.append("td").text(function(d) { return d.key.join(","); });
  rejectRows.append("td").text(function(d) { return d.count; });
}

function setupTerminations(eid, section) {
  var terminations = [];
  var termReasons = d3.map();

  iterDates().forEach(function(datestr) {
    var day = gData.get(datestr);
    if (!day) {
      return;
    }
    if (!(eid in day.experiments)) {
      return;
    }
    var total = 0;
    day.experiments[eid].terminations.forEach(function (d) {
      var key = d[0];
      var keystr = d[0].join(',');
      total += d[1];
      if (!termReasons.has(keystr)) {
        termReasons.set(keystr, { key: key, count: 0 });
      }
      termReasons.get(keystr).count += d[1];
    });
    if (total) {
      terminations.push({ datestr: datestr, count: total });
    }
  });

  var termRows = section.select(".termTable tbody").text("")
    .selectAll("tr").data(terminations).enter().append("tr");
  termRows.append("td").text(function(d) { return d.datestr; });
  termRows.append("td").text(function(d) { return d.count; });

  termReasons = termReasons.values();
  termReasons.sort(function(a, b) { return d3.descending(a.count, b.count); });

  var reasonRows = section.select(".termReasonsTable tbody").text("")
    .selectAll("tr").data(termReasons).enter().append("tr");
  reasonRows.append("td").text(function(d) { return d.key.join(","); });
  reasonRows.append("td").text(function(d) { return d.count; });
}

function doGraph() {
  // first find all the experiments
  var experiments = d3.set();
  iterDates().forEach(function(d) {
    var data = gData.get(d);
    if (!data) {
      return;
    }
    d3.keys(data.experiments).forEach(function(eid) { experiments.add(eid); });
  });
  experiments = experiments.values();
  experiments.sort();
  var sections = d3.select("#data")
    .selectAll("section.experiment")
    .data(experiments, function(d) { return "exp-" + d; });

  sections.exit().remove();

  var newsections = sections.enter()
    .append("section").classed("experiment", true).attr("id", function(d) { return "exp-" + d; });
  newsections.append("h2").text(identity);
  newsections.append("h3").text("Install Ratio");
  newsections.append("p").attr("class", "installRatioContainer").append("svg").classed("installRatio", true);
  newsections.append("h3").text("Activation Counts");
  newsections.append("p").append("table")
    .classed({"activationTable": true, "data": true})
    .html("<thead><tr><td>Date<td>#<tbody>");
  newsections.append("h3").text("Branches");
  newsections.append("p").append("table")
    .classed({"branchTable": true, "data": true})
    .html("<thead><tr><td>Branch<td>#<td>%<tbody>");
  newsections.append("h3").text("Failed Activations");
  newsections.append("p").append("table")
    .classed({"failedTable": true, "data": true})
    .html("<thead><tr><td>Reason<td>#<tbody>");
  newsections.append("h3").text("Terminations");
  newsections.append("p").append("table")
    .classed({"termTable": true, "data": true})
   .html("<thead><tr><td>Date<td>#<tbody>");
  newsections.append("p").append("table")
    .classed({"termReasonsTable": true, "data": true})
   .html("<thead><tr><td>Reason<td>#<tbody>");

  sections.each(function(eid) {
    var section = d3.select(this);
    setupInstallRatio(eid, section);
    setupBranches(eid, section);
    setupActivations(eid, section);
    setupTerminations(eid, section);
  });
}

// Now kick everything off. Initialize values from the query string
var params = document.location.search;
if (params.length) {
  params.slice(1).split("&").forEach(function(item) {
    var r = /^(.*?)(=(.*))?$/.exec(item);
    var key = decodeURIComponent(r[1]);
    var val = decodeURIComponent(r[3]);
    switch (key) {
      case "channel":
        d3.selectAll('input[name="channel"]').filter(function() {
          return d3.select(this).property("value") == val;
        }).property("checked", true);
        break;
      case "startDate":
      case "endDate":
        d3.select("#" + key).property("value", val);
      }
  });
}

initAndFetch();

d3.select("#setupForm").on("submit", function() {
  var d = valueToDate(d3.select("#startDate").property("value"), -1);
  if (!dateIsValid(d)) {
    alert("Last date is invalid.");
    d3.event.preventDefault();
  }
  d = valueToDate(d3.select("#endDate").property("value"), -15);
  if (!dateIsValid(d)) {
    alert("First date is invalid!");
    d3.event.preventDefault();
  }
});
