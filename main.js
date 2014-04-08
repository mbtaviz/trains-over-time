(function () {
  "use strict";
  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      delay = 100,
      radius = 2.5,
      cache = {},
      idToLine = {},
      crowd = {},
      distScale,
      spider = window.location.search === '?flat' ? window.spider2 : window.spider;

  d3.json('data.json', function (inputData) {
    var idToNode = {};
    inputData.nodes.forEach(function (data) {
      data.x = spider[data.id][0];
      data.y = spider[data.id][1];
      idToNode[data.id] = data;
    });
    inputData.links.forEach(function (link) {
      link.source = inputData.nodes[link.source];
      link.target = inputData.nodes[link.target];
      link.source.links = link.source.links || [];
      link.target.links = link.target.links || [];
      link.target.links.splice(0, 0, link);
      link.source.links.splice(0, 0, link);
      idToLine[link.source.id + '|' + link.target.id] = link.line;
      idToLine[link.target.id + '|' + link.source.id] = link.line;
    });
    var xRange = d3.extent(inputData.nodes, function (d) { return d.x; });
    var yRange = d3.extent(inputData.nodes, function (d) { return d.y; });

    var nodesById = {};
    var outerWidth = 400,
        outerHeight = 400;
    var m = Math.min(outerWidth, outerHeight) / 20;
    margin = {
      top: m,
      right: m,
      bottom: m,
      left: m
    };
    var width = outerWidth - margin.left - margin.right,
        height = outerHeight - margin.top - margin.bottom;
    var xScale = width / (xRange[1] - xRange[0]);
    var yScale = height / (yRange[1] - yRange[0]);
    var scale = Math.min(xScale, yScale);
    var endDotRadius = 0.2 * scale;
    inputData.nodes.forEach(function (data) {
      data.pos = [data.x * scale, data.y * scale];
      nodesById[data.id] = data;
    });
    d3.select('svg').remove();
    var svg = d3.select('#chart').append('svg')
        .attr('width', scale * xRange[1] + margin.left + margin.right)
        .attr('height', scale * yRange[1] + margin.top + margin.bottom)
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([-10, 0])
        .html(function(d) { return d.name; });
    svg.call(tip);

    svg.selectAll('.station')
        .data(inputData.nodes)
        .enter()
      .append('circle')
        .attr('class', function (d) { return 'station middle station-label ' + d.id; })
        .attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; })
        .attr('r', 3)
        .on('mouseover', function (d) {
          if (d.pos[1] < 30) {
            tip.direction('e')
              .offset([0, 10]);
          } else {
            tip.direction('n')
              .offset([-10, 0]);
          }
          tip.show(d);
          window.highlightMareyTitle(d.id, _.unique(d.links.map(function (link) { return link.line; })));
        })
        .on('mouseout', function (d) {
          tip.hide(d);
          window.highlightMareyTitle(null);
        });

    svg.selectAll('.connect')
        .data(inputData.links)
        .enter()
      .append('line')
        .attr('class', 'connect')
        .attr('x1', function (d) { return d.source.pos[0]; })
        .attr('y1', function (d) { return d.source.pos[1]; })
        .attr('x2', function (d) { return d.target.pos[0]; })
        .attr('y2', function (d) { return d.target.pos[1]; });

    // line color circles
    function dot(id, clazz) {
      svg.selectAll('circle.' + id)
        .classed(clazz, true)
        .classed('end', true)
        .classed('middle', false)
        .attr('r', endDotRadius);
    }
    dot('place-asmnl', "red");
    dot('place-alfcl', "red");
    dot('place-brntn', "red");
    dot('place-wondl', "blue");
    dot('place-bomnl', "blue");
    dot('place-forhl', "orange");
    dot('place-ogmnl', "orange");

    var timeDisplay = d3.select('#time');

    d3.json('historical.json')
    .on('progress', function() {
      var pct = Math.round(100 * d3.event.loaded / 809000);
      timeDisplay.text("Loading... " + pct + "%");
    })
    .get(function(error, data) {
      // data is:
      // [
      //   {
      //     "trip": "B98A378CB",
      //     "begin": 1391577320,
      //     "end": 1391578396,
      //     "stops": [
      //       {
      //         "stop": "place-wondl",
      //         "time": 1391577320
      //       },
      //       ...
      //     ]
      //   },
      //   ...
      // ]

      // show train positions
      function placeWithOffset(from, to, ratio) {
        var fromPos = idToNode[from.stop].pos;
        var toPos = idToNode[to.stop].pos;
        var midpoint = d3.interpolate(fromPos, toPos)(ratio);
        var angle = Math.atan2(toPos[1] - fromPos[1], toPos[0] - fromPos[0]) + Math.PI / 2;
        return [midpoint[0] + Math.cos(angle) * radius, midpoint[1] + Math.sin(angle) * radius];
      }

      function render(unixSeconds) {
        var active = data.filter(function (d) {
          return d.begin < unixSeconds && d.end > unixSeconds;
        });
        var positions = active.map(function (d) {
          // get prev, next stop and mix
          for (var i = 0; i < d.stops.length - 1; i++) {
            if (d.stops[i + 1].time > unixSeconds) {
              break;
            }
          }
          var from = d.stops[i];
          var to = d.stops[i + 1];
          var ratio = (unixSeconds - from.time) / (to.time - from.time);
          return {trip: d.trip, pos: placeWithOffset(from, to, ratio), line: d.line};
        });

        var trains = svg.selectAll('.train').data(positions, function (d) { return d.trip; });
        trains//.transition().duration(delay).ease('linear')
            .attr('cx', function (d) { return d.pos[0]; })
            .attr('cy', function (d) { return d.pos[1]; });
        trains.enter().append('circle')
            .attr('class', function (d) { return 'train highlightable hoverable dimmable ' + d.line; })
            .classed('active', function (d) { return d.trip === window.highlightedTrip; })
            .classed('hover', function (d) { return d.trip === window.hoveredTrip; })
            .attr('r', radius)
            .attr('cx', function (d) { return d.pos[0]; })
            .attr('cy', function (d) { return d.pos[1]; })
            .on('click', function (d) { window.highlightTrain(d); })
            .on('mouseover', window.hoverTrain)
            .on('mouseout', window.unHoverTrain);
        trains.exit().remove();
        timeDisplay.text(moment(unixSeconds * 1000).format('h:mm a'));
      }

      window.render = render;

      // draw marey
      window.drawMarey(inputData, data);
    });
  });
}());