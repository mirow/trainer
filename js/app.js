'use strict';

var controllers = angular.module('controllers', []);
var app = angular.module('app', ['controllers']);

controllers.controller(
  'graphCtrl',
  function ($scope) {

    $scope.distance = 50;
    $scope.chartType = 1;
    $scope.files = [];
    $scope.selected = {};

     $scope.readSingleFile = function() {
      //Retrieve the first (and only!) File from the FileList object
      var f = document.getElementById('fileinput').files[0];
      if (f) {
        var r = new FileReader();
        r.onload = function (e) {
          $scope.convertToJson(e.target.result);
        };
        r.readAsText(f);
      } else {
        alert("Failed to load file");
      }
    }

    function drawChart(data) {

      var options = {
        legend: 'none',
        width: 1000,
        height: 500,
        pointSize: 2,
        lineWidth: 1,
        chartArea: {left: '5%', top: '5%', width: '90%', height: '85%', backgroundColor: 'transparent' },
        backgroundColor: 'transparent'
      };
      if ($scope.chartType == '1') {
        options.title = 'Speed vs. Distance comparison';
        options.vAxis = {title: 'Speed', minValue: 0, maxValue: 15};
        options.hAxis = {title: 'Distance', minValue: 7};
      } else if ($scope.chartType == '2') {
        options.title = 'HR vs. Distance comparison';
        options.vAxis = {
          title: 'HR',
          format: '###',
          minValue: 52,
          maxValue: 186,
/*          gridlines: { count: 0 },*/
          viewWindow: { min: 52, max: 186},
          ticks: [52, 118, 131, 145, 158, 172, 186]
        };
        options.hAxis = {title: 'Distance'};
      } else if ($scope.chartType == '3') {
        options.title = 'HR vs Speed comparison';
        options.vAxis = {title: 'HR', minValue: 52, maxValue: 186,
          gridlines: { count: 0 },
          viewWindow: { min: 52, max: 186}};
        options.hAxis = {title: 'Speed', minValue: 7, maxValue: 15};
      }

      var chart = new google.visualization.ScatterChart(document.getElementById('chart_div'));

      chart.draw(data, options);
    }

    $scope.convertToJson = function(text) {
      var oParser = new DOMParser();
      var oDOM = oParser.parseFromString(text, "text/xml");
      var jsonString = xml2json(oDOM, '');
      var trackObject = JSON.parse(jsonString);
      var id;
      var points = [];
      if (trackObject.TrainingCenterDatabase) {
        id = trackObject.TrainingCenterDatabase.Activities.Activity.Id;
        _.forEach(trackObject.TrainingCenterDatabase.Activities.Activity.Lap.Track.Trackpoint, function (dataPoint) {
          points.push({
            lat: dataPoint.Position.LatitudeDegrees,
            lon: dataPoint.Position.LongitudeDegrees,
            time: dataPoint.Time,
            elevation: dataPoint.AltitudeMeters,
            hr: dataPoint.HeartRateBpm.Value
          });
        });
      } else if (trackObject.gpx) {
        var pointData;
        if (trackObject.gpx.trk.trkseg.trkpt) {
          pointData = trackObject.gpx.trk.trkseg.trkpt;
        } else {
          pointData = trackObject.gpx.trk.trkseg.trkpt[0];
        }
        id = pointData[0].time;
        _.forEach(pointData, function (dataPoint) {
          points.push({
            lat: dataPoint['@lat'],
            lon: dataPoint['@lon'],
            time: dataPoint.time,
            elevation: dataPoint['ele'],
            hr: dataPoint.extensions ? dataPoint.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'] : null
          });
        });
      }

      $scope.files.push(id);
      localStorage.setItem('names', JSON.stringify($scope.files));
      localStorage.setItem(id, JSON.stringify(points));
      //$scope.$apply();
    };

    $scope.updateListing = function() {
      var names = localStorage.getItem('names');
      if (!names) return;
      $scope.files = JSON.parse(names);
    };

    $scope.joinAndDraw = function() {
      var data = null;
      var n=1;
      _.forEach($scope.selected, function (value, key) {
        var tmpData = google.visualization.arrayToDataTable(getPoints(key));
        if (data == null) {
          data = tmpData;
        } else {
          n++;
          data = google.visualization.data.join(
            data,
            tmpData,
            'full',
            [ _.fill(Array(n), 0) ],
            _.range(1, n),
            [1]
          );
        }
      });

      drawChart(data);
    };

    $scope.showFile = function (name) {
      var data = google.visualization.arrayToDataTable(getPoints(name));
      drawChart(data);
    };

    function getDistance(lat1, lon1, lat2, lon2) {
      var R = 6371000; // metres
      var φ1 = Number(lat1).toRadians();
      var φ2 = Number(lat2).toRadians();
      var Δφ = (lat2 - lat1).toRadians();
      var Δλ = (lon2 - lon1).toRadians();

      var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    }

    function getPoints(name) {
      var arr = JSON.parse(localStorage.getItem(name));

      var lastLon, lastLat, lastTime;
      var totalDist = 0;
      var totalTime = 0;
      var grandTotalDist = 0;
      var grandTotalTime = 0;
      var hrSum = 0;
      var pointCount = 0;
      var chartType = $scope.chartType;
      var points;
      if (chartType == '1') {
        points = [
          ['Distance', 'Speed (' + name + ')']
        ];
      } else if (chartType == '2') {
        points = [
          ['Distance', 'HR (' + name + ')']
        ];
      } else {
        points = [
          ['Speed', 'HR (' + name + ')']
        ];
      }
      var dist;
      var time;
      var distanceStep = parseInt($scope.distance);
      var distancePoint = parseInt(distanceStep);
      arr.forEach(function (point) {
        hrSum += parseInt(point.hr);
        pointCount++;

        if (point.lon != lastLon || point.lat != lastLat) {
          if (lastLon) {
            dist = getDistance(lastLat, lastLon, point.lat, point.lon);
            time = (new Date(point.time) - lastTime) / 1000;
          } else {
            dist = 0;
            time = 0;
          }
          totalDist += dist;
          totalTime += time;
          grandTotalDist += dist;
          grandTotalTime += time;
          lastLon = point.lon;
          lastLat = point.lat;
          lastTime = new Date(point.time);
          if (grandTotalDist > distancePoint) {
            if (chartType == '1') {
              if (distancePoint == distanceStep) {
                points.push([0, (totalDist / 1000) / (totalTime / 3600)]);
              }
              points.push([(distancePoint / 1000), (totalDist / 1000) / (totalTime / 3600)]);
            } else if (chartType == '2') {
              if (distancePoint == distanceStep) {
                points.push([0, hrSum / pointCount]);
              }
              points.push([(distancePoint / 1000), hrSum / pointCount]);
            } else {
              points.push([(totalDist / 1000) / (totalTime / 3600), hrSum / pointCount]);
            }
            distancePoint += distanceStep;
            totalTime = 0;
            totalDist = 0;
            hrSum = 0;
            pointCount = 0;
          }
        }
      });
      return points;
    }

    $scope.updateListing();

  });
