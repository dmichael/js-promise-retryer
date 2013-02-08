var ExponentialStrategy, LinearStrategy, Retryer, convenience,
  __slice = [].slice;

ExponentialStrategy = (function() {

  function ExponentialStrategy(exponent) {
    this.exponent = exponent != null ? exponent : 2;
  }

  ExponentialStrategy.prototype.getInterval = function(n) {
    return (Math.pow(2, this.exponent) * 1000) + Math.round(Math.random() * 1000);
  };

  return ExponentialStrategy;

})();

LinearStrategy = (function() {

  function LinearStrategy(slope) {
    this.slope = slope != null ? slope : 2;
  }

  LinearStrategy.prototype.getInterval = function(n) {
    return ((n * this.slope) * 1000) + Math.round(Math.random() * 1000);
  };

  return LinearStrategy;

})();

Retryer = (function() {

  function Retryer(options) {
    if (options == null) {
      options = {};
    }
    this.maxCount = options.attempts || 5;
    this.maxInterval = parseInt(options.maxInterval || 15000);
    this.strategy = new LinearStrategy();
    this.counter = 0;
    this.deferred = $.Deferred();
  }

  Retryer.prototype.canRetry = function() {
    if (this.maxCount === 'infinity') {
      return true;
    }
    return this.counter <= (this.maxCount - 1);
  };

  Retryer.prototype.promise = function() {
    return this.deferred.promise();
  };

  Retryer.prototype.getState = function() {
    return this.deferred.promise.state();
  };

  Retryer.prototype.getNextAttemptInterval = function() {
    return this.strategy.getInterval(this.counter);
  };

  Retryer.prototype.cancel = function() {
    return this.canceled = true;
  };

  Retryer.prototype.perform = function(action) {
    var promise,
      _this = this;
    promise = action();
    promise.done(function(data) {
      return _this.deferred.resolve(data);
    });
    promise.fail(function(error) {
      var interval, message;
      interval = _this.getNextAttemptInterval();
      if (interval >= _this.maxInterval) {
        interval = _this.maxInterval;
      }
      message = "Failed " + _this.counter + " of " + (_this.maxCount || 'infinity') + "!";
      _this.deferred.notify({
        error: error,
        attempts: _this.counter,
        interval: interval,
        message: message
      });
      if ((_this.canRetry() && _.isNumber(interval)) && !_this.canceled) {
        if (console) {
          console.debug("Trying again in " + interval + " ms");
        }
        _this.counter++;
        return _this.timer = setTimeout((function() {
          return _this.perform(action);
        }), interval);
      } else {
        message = _this.canceled ? "Fatal! Action canceled." : "Fatal! Tried " + _this.counter + " times and failed - I give up.";
        return _this.deferred.reject({
          error: error,
          attempts: _this.counter,
          interval: interval,
          message: message
        });
      }
    });
    promise = this.deferred.promise();
    promise.cancel = function() {
      return _this.cancel();
    };
    return promise;
  };

  return Retryer;

})();

convenience = function(func, options, scope) {
  var retryer,
    _this = this;
  if (options == null) {
    options = {};
  }
  if (!_(func).isFunction()) {
    throw "I only accept Functions that return promises. :zap:.";
  }
  retryer = new Retryer(options);
  return function() {
    var args, wrapped;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    wrapped = (function() {
      return func.apply(scope, args);
    });
    return retryer.perform(wrapped);
  };
};

if (jQuery) {
  (function($) {
    return $.fn.retry = convenience;
  })(jQuery);
}

if (_) {
  _.mixin({
    retry: convenience
  });
}

window.Retryer = Retryer;
