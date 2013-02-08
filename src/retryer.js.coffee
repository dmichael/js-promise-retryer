

class ExponentialStrategy
  constructor: (@exponent = 2) ->

  getInterval: (n) ->
    (Math.pow(2,@exponent)*1000) + Math.round(Math.random() * 1000)

class LinearStrategy
  constructor: (@slope = 2) ->

  getInterval: (n) ->
    ((n*@slope)*1000) + Math.round(Math.random() * 1000)



class Retryer
# options:
#   interval - number in seconds
#   attempts - number of times the retrier tries
  constructor: (options = {}) ->
    @maxCount    = options.attempts or 5
    @maxInterval = parseInt(options.maxInterval or 15000)

    @strategy = new LinearStrategy()
    @counter  = 0
    @deferred = $.Deferred()

  canRetry: ->
    return true if @maxCount is 'infinity' #_(@maxCount).isUndefined() or _(@maxCount).isNull()
    @counter <= (@maxCount - 1)

  promise: -> @deferred.promise()

  getState: -> @deferred.promise.state()

  # consider counter should be always greater than zero
  getNextAttemptInterval: ->
    @strategy.getInterval(@counter)

  cancel: ->
    @canceled = true


  perform: (action) ->
    promise = action()

    promise.done (data) =>
      @deferred.resolve data

    promise.fail (error) =>
      interval = @getNextAttemptInterval()
      interval = @maxInterval if interval >= @maxInterval
      message = "Failed #{@counter} of #{@maxCount or 'infinity'}!"
      # console.debug message if console
      @deferred.notify
        error: error
        attempts: @counter
        interval: interval
        message: message

      # we reject the result in case of all attempts have already been used or we don't have interval anymore
      if (@canRetry() and _.isNumber(interval)) and not @canceled
        console.debug "Trying again in #{interval} ms" if console
        @counter++
        @timer = setTimeout (=> @perform action), (interval)
      else
        message = if @canceled
          "Fatal! Action canceled."
        else
          "Fatal! Tried #{@counter} times and failed - I give up."
        # console.debug message if console
        @deferred.reject(error: error, attempts: @counter, interval: interval, message: message)

    # Return a promise
    promise = @deferred.promise()
    promise.cancel = => @cancel() # expose the ability to cancel through the promise
    promise


convenience = (func, options = {}, scope) ->
  # This only accepts jQuery Deferred objects at the moment
  throw "I only accept Functions that return promises. :zap:." unless _(func).isFunction()

  retryer = new Retryer(options)

  # This anon function does the dirty work
  return (args...) =>
    wrapped = (=> func.apply(scope, args))
    retryer.perform(wrapped)


# A jQuery plugin
(( $ ) -> $.fn.retry = convenience )( jQuery ) if jQuery

# An underscore mixin
_.mixin(retry: convenience) if _


window.Retryer = Retryer


