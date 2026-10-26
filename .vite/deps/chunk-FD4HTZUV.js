// node_modules/d3-array/src/ascending.js
function ascending_default(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

// node_modules/d3-array/src/bisector.js
function bisector_default(compare) {
  if (compare.length === 1) compare = ascendingComparator(compare);
  return {
    left: function(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      while (lo < hi) {
        var mid = lo + hi >>> 1;
        if (compare(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    right: function(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      while (lo < hi) {
        var mid = lo + hi >>> 1;
        if (compare(a[mid], x) > 0) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    }
  };
}
function ascendingComparator(f) {
  return function(d, x) {
    return ascending_default(f(d), x);
  };
}

// node_modules/d3-array/src/bisect.js
var ascendingBisect = bisector_default(ascending_default);
var bisectRight = ascendingBisect.right;
var bisectLeft = ascendingBisect.left;
var bisect_default = bisectRight;

// node_modules/d3-array/src/pairs.js
function pairs_default(array2, f) {
  if (f == null) f = pair;
  var i = 0, n = array2.length - 1, p = array2[0], pairs = new Array(n < 0 ? 0 : n);
  while (i < n) pairs[i] = f(p, p = array2[++i]);
  return pairs;
}
function pair(a, b) {
  return [a, b];
}

// node_modules/d3-array/src/cross.js
function cross_default(values0, values1, reduce) {
  var n0 = values0.length, n1 = values1.length, values = new Array(n0 * n1), i0, i1, i, value0;
  if (reduce == null) reduce = pair;
  for (i0 = i = 0; i0 < n0; ++i0) {
    for (value0 = values0[i0], i1 = 0; i1 < n1; ++i1, ++i) {
      values[i] = reduce(value0, values1[i1]);
    }
  }
  return values;
}

// node_modules/d3-array/src/descending.js
function descending_default(a, b) {
  return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
}

// node_modules/d3-array/src/number.js
function number_default(x) {
  return x === null ? NaN : +x;
}

// node_modules/d3-array/src/variance.js
function variance_default(values, valueof) {
  var n = values.length, m = 0, i = -1, mean = 0, value, delta, sum = 0;
  if (valueof == null) {
    while (++i < n) {
      if (!isNaN(value = number_default(values[i]))) {
        delta = value - mean;
        mean += delta / ++m;
        sum += delta * (value - mean);
      }
    }
  } else {
    while (++i < n) {
      if (!isNaN(value = number_default(valueof(values[i], i, values)))) {
        delta = value - mean;
        mean += delta / ++m;
        sum += delta * (value - mean);
      }
    }
  }
  if (m > 1) return sum / (m - 1);
}

// node_modules/d3-array/src/deviation.js
function deviation_default(array2, f) {
  var v = variance_default(array2, f);
  return v ? Math.sqrt(v) : v;
}

// node_modules/d3-array/src/extent.js
function extent_default(values, valueof) {
  var n = values.length, i = -1, value, min, max;
  if (valueof == null) {
    while (++i < n) {
      if ((value = values[i]) != null && value >= value) {
        min = max = value;
        while (++i < n) {
          if ((value = values[i]) != null) {
            if (min > value) min = value;
            if (max < value) max = value;
          }
        }
      }
    }
  } else {
    while (++i < n) {
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        min = max = value;
        while (++i < n) {
          if ((value = valueof(values[i], i, values)) != null) {
            if (min > value) min = value;
            if (max < value) max = value;
          }
        }
      }
    }
  }
  return [min, max];
}

// node_modules/d3-array/src/array.js
var array = Array.prototype;
var slice = array.slice;
var map = array.map;

// node_modules/d3-array/src/constant.js
function constant_default(x) {
  return function() {
    return x;
  };
}

// node_modules/d3-array/src/identity.js
function identity_default(x) {
  return x;
}

// node_modules/d3-array/src/range.js
function range_default(start, stop, step) {
  start = +start, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;
  var i = -1, n = Math.max(0, Math.ceil((stop - start) / step)) | 0, range = new Array(n);
  while (++i < n) {
    range[i] = start + i * step;
  }
  return range;
}

// node_modules/d3-array/src/ticks.js
var e10 = Math.sqrt(50);
var e5 = Math.sqrt(10);
var e2 = Math.sqrt(2);
function ticks_default(start, stop, count) {
  var reverse, i = -1, n, ticks, step;
  stop = +stop, start = +start, count = +count;
  if (start === stop && count > 0) return [start];
  if (reverse = stop < start) n = start, start = stop, stop = n;
  if ((step = tickIncrement(start, stop, count)) === 0 || !isFinite(step)) return [];
  if (step > 0) {
    start = Math.ceil(start / step);
    stop = Math.floor(stop / step);
    ticks = new Array(n = Math.ceil(stop - start + 1));
    while (++i < n) ticks[i] = (start + i) * step;
  } else {
    start = Math.floor(start * step);
    stop = Math.ceil(stop * step);
    ticks = new Array(n = Math.ceil(start - stop + 1));
    while (++i < n) ticks[i] = (start - i) / step;
  }
  if (reverse) ticks.reverse();
  return ticks;
}
function tickIncrement(start, stop, count) {
  var step = (stop - start) / Math.max(0, count), power = Math.floor(Math.log(step) / Math.LN10), error = step / Math.pow(10, power);
  return power >= 0 ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power) : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
}
function tickStep(start, stop, count) {
  var step0 = Math.abs(stop - start) / Math.max(0, count), step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)), error = step0 / step1;
  if (error >= e10) step1 *= 10;
  else if (error >= e5) step1 *= 5;
  else if (error >= e2) step1 *= 2;
  return stop < start ? -step1 : step1;
}

// node_modules/d3-array/src/threshold/sturges.js
function sturges_default(values) {
  return Math.ceil(Math.log(values.length) / Math.LN2) + 1;
}

// node_modules/d3-array/src/histogram.js
function histogram_default() {
  var value = identity_default, domain = extent_default, threshold = sturges_default;
  function histogram(data) {
    var i, n = data.length, x, values = new Array(n);
    for (i = 0; i < n; ++i) {
      values[i] = value(data[i], i, data);
    }
    var xz = domain(values), x0 = xz[0], x1 = xz[1], tz = threshold(values, x0, x1);
    if (!Array.isArray(tz)) {
      tz = tickStep(x0, x1, tz);
      tz = range_default(Math.ceil(x0 / tz) * tz, x1, tz);
    }
    var m = tz.length;
    while (tz[0] <= x0) tz.shift(), --m;
    while (tz[m - 1] > x1) tz.pop(), --m;
    var bins = new Array(m + 1), bin;
    for (i = 0; i <= m; ++i) {
      bin = bins[i] = [];
      bin.x0 = i > 0 ? tz[i - 1] : x0;
      bin.x1 = i < m ? tz[i] : x1;
    }
    for (i = 0; i < n; ++i) {
      x = values[i];
      if (x0 <= x && x <= x1) {
        bins[bisect_default(tz, x, 0, m)].push(data[i]);
      }
    }
    return bins;
  }
  histogram.value = function(_) {
    return arguments.length ? (value = typeof _ === "function" ? _ : constant_default(_), histogram) : value;
  };
  histogram.domain = function(_) {
    return arguments.length ? (domain = typeof _ === "function" ? _ : constant_default([_[0], _[1]]), histogram) : domain;
  };
  histogram.thresholds = function(_) {
    return arguments.length ? (threshold = typeof _ === "function" ? _ : Array.isArray(_) ? constant_default(slice.call(_)) : constant_default(_), histogram) : threshold;
  };
  return histogram;
}

// node_modules/d3-array/src/quantile.js
function quantile_default(values, p, valueof) {
  if (valueof == null) valueof = number_default;
  if (!(n = values.length)) return;
  if ((p = +p) <= 0 || n < 2) return +valueof(values[0], 0, values);
  if (p >= 1) return +valueof(values[n - 1], n - 1, values);
  var n, i = (n - 1) * p, i0 = Math.floor(i), value0 = +valueof(values[i0], i0, values), value1 = +valueof(values[i0 + 1], i0 + 1, values);
  return value0 + (value1 - value0) * (i - i0);
}

// node_modules/d3-array/src/threshold/freedmanDiaconis.js
function freedmanDiaconis_default(values, min, max) {
  values = map.call(values, number_default).sort(ascending_default);
  return Math.ceil((max - min) / (2 * (quantile_default(values, 0.75) - quantile_default(values, 0.25)) * Math.pow(values.length, -1 / 3)));
}

// node_modules/d3-array/src/threshold/scott.js
function scott_default(values, min, max) {
  return Math.ceil((max - min) / (3.5 * deviation_default(values) * Math.pow(values.length, -1 / 3)));
}

// node_modules/d3-array/src/max.js
function max_default(values, valueof) {
  var n = values.length, i = -1, value, max;
  if (valueof == null) {
    while (++i < n) {
      if ((value = values[i]) != null && value >= value) {
        max = value;
        while (++i < n) {
          if ((value = values[i]) != null && value > max) {
            max = value;
          }
        }
      }
    }
  } else {
    while (++i < n) {
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        max = value;
        while (++i < n) {
          if ((value = valueof(values[i], i, values)) != null && value > max) {
            max = value;
          }
        }
      }
    }
  }
  return max;
}

// node_modules/d3-array/src/mean.js
function mean_default(values, valueof) {
  var n = values.length, m = n, i = -1, value, sum = 0;
  if (valueof == null) {
    while (++i < n) {
      if (!isNaN(value = number_default(values[i]))) sum += value;
      else --m;
    }
  } else {
    while (++i < n) {
      if (!isNaN(value = number_default(valueof(values[i], i, values)))) sum += value;
      else --m;
    }
  }
  if (m) return sum / m;
}

// node_modules/d3-array/src/median.js
function median_default(values, valueof) {
  var n = values.length, i = -1, value, numbers = [];
  if (valueof == null) {
    while (++i < n) {
      if (!isNaN(value = number_default(values[i]))) {
        numbers.push(value);
      }
    }
  } else {
    while (++i < n) {
      if (!isNaN(value = number_default(valueof(values[i], i, values)))) {
        numbers.push(value);
      }
    }
  }
  return quantile_default(numbers.sort(ascending_default), 0.5);
}

// node_modules/d3-array/src/merge.js
function merge_default(arrays) {
  var n = arrays.length, m, i = -1, j = 0, merged, array2;
  while (++i < n) j += arrays[i].length;
  merged = new Array(j);
  while (--n >= 0) {
    array2 = arrays[n];
    m = array2.length;
    while (--m >= 0) {
      merged[--j] = array2[m];
    }
  }
  return merged;
}

// node_modules/d3-array/src/min.js
function min_default(values, valueof) {
  var n = values.length, i = -1, value, min;
  if (valueof == null) {
    while (++i < n) {
      if ((value = values[i]) != null && value >= value) {
        min = value;
        while (++i < n) {
          if ((value = values[i]) != null && min > value) {
            min = value;
          }
        }
      }
    }
  } else {
    while (++i < n) {
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        min = value;
        while (++i < n) {
          if ((value = valueof(values[i], i, values)) != null && min > value) {
            min = value;
          }
        }
      }
    }
  }
  return min;
}

// node_modules/d3-array/src/permute.js
function permute_default(array2, indexes) {
  var i = indexes.length, permutes = new Array(i);
  while (i--) permutes[i] = array2[indexes[i]];
  return permutes;
}

// node_modules/d3-array/src/scan.js
function scan_default(values, compare) {
  if (!(n = values.length)) return;
  var n, i = 0, j = 0, xi, xj = values[j];
  if (compare == null) compare = ascending_default;
  while (++i < n) {
    if (compare(xi = values[i], xj) < 0 || compare(xj, xj) !== 0) {
      xj = xi, j = i;
    }
  }
  if (compare(xj, xj) === 0) return j;
}

// node_modules/d3-array/src/shuffle.js
function shuffle_default(array2, i0, i1) {
  var m = (i1 == null ? array2.length : i1) - (i0 = i0 == null ? 0 : +i0), t, i;
  while (m) {
    i = Math.random() * m-- | 0;
    t = array2[m + i0];
    array2[m + i0] = array2[i + i0];
    array2[i + i0] = t;
  }
  return array2;
}

// node_modules/d3-array/src/sum.js
function sum_default(values, valueof) {
  var n = values.length, i = -1, value, sum = 0;
  if (valueof == null) {
    while (++i < n) {
      if (value = +values[i]) sum += value;
    }
  } else {
    while (++i < n) {
      if (value = +valueof(values[i], i, values)) sum += value;
    }
  }
  return sum;
}

// node_modules/d3-array/src/transpose.js
function transpose_default(matrix) {
  if (!(n = matrix.length)) return [];
  for (var i = -1, m = min_default(matrix, length), transpose = new Array(m); ++i < m; ) {
    for (var j = -1, n, row = transpose[i] = new Array(n); ++j < n; ) {
      row[j] = matrix[j][i];
    }
  }
  return transpose;
}
function length(d) {
  return d.length;
}

// node_modules/d3-array/src/zip.js
function zip_default() {
  return transpose_default(arguments);
}

export {
  ascending_default,
  bisector_default,
  bisectRight,
  bisectLeft,
  bisect_default,
  pairs_default,
  cross_default,
  descending_default,
  variance_default,
  deviation_default,
  extent_default,
  range_default,
  ticks_default,
  tickIncrement,
  tickStep,
  sturges_default,
  histogram_default,
  quantile_default,
  freedmanDiaconis_default,
  scott_default,
  max_default,
  mean_default,
  median_default,
  merge_default,
  min_default,
  permute_default,
  scan_default,
  shuffle_default,
  sum_default,
  transpose_default,
  zip_default
};
//# sourceMappingURL=chunk-FD4HTZUV.js.map
