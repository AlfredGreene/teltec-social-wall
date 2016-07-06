window.twttr = (function(d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0],
    t = window.twttr || {};
  if (d.getElementById(id)) return t;
  js = d.createElement(s);
  js.id = id;
  js.src = "https://platform.twitter.com/widgets.js";
  fjs.parentNode.insertBefore(js, fjs);
 
  t._e = [];
  t.ready = function(f) {
    t._e.push(f);
  };
 
  return t;
}(document, "script", "twitter-wjs"));

$(document).ready(function() {
  var _config = {
    'max_visible_tweets': 2,
    'update_interval': 5000, // In milliseconds
    'websocket_retry_connection_interval': 5000, // In milliseconds
  };

  var _state = {
    'updating': true,
  };

  $('.config-form').on('submit', function (event) {
    event.preventDefault();
    if (!document.activeElement.name)
      return;
    var $button = $(this).find('[name=' + document.activeElement.name + ']');
    var action = $button.attr('name');
    switch (action) {
      case 'save':
        update_config($(this));
        break;
      case 'stop':
        var updating = _state['updating'];
        if (updating) {
          $button.text("{% trans 'Start' %}");
          _state['updating'] = false;
        } else {
          $button.text("{% trans 'Stop' %}");
          _state['updating'] = true;
          setTimeout(track_and_update_visible_tweets, _config['update_interval']);
        }
        break;
    }
    $('.config-panel').toggle();
  });

  var populate_config_form = function () {
    for (var key in _config) {
      if (_config.hasOwnProperty(key)) {
        $('.config-form').find('.config[data-item='+key+']').each(function (i, elem) {
          $(elem).val(_config[key]);
        });
      }
    }
  };

  var on_config_property_update = function (property_name) {
    switch (property_name) {
      case 'title':
        $('.live-tweets-title').text(_config['title']);
        break;
    }
  };

  var update_config = function($form) {
    $form.find('.config[data-item]').each(function (i, elem) {
      var $elem = $(elem);
      var property = $elem.attr('data-item');
      var value = $elem.val();
      var type = $elem.attr('data-type');
      switch (type) {
        default: break;
        case 'float':
          _config[property] = parseFloat(value);
          break;
        case 'int':
          _config[property] = parseInt(value);
          break;
        case 'str':
          _config[property] = value;
          break;
      }
      on_config_property_update(property);
    });
    console.log('Saved config: ' + JSON.stringify(_config));
  };

  var _endpoint = 'ws://live-tweets.mybluemix.net/ws/tweets/teltec';
  var _socket;
  var _visible_tweets = [];
  var _queued_tweets = [];

  var connect_to_live_tweets = function () {
    _socket = new WebSocket(_endpoint);
    _socket.onerror = _socket_onerror;
    _socket.onopen = _socket_onopen;
    _socket.onmessage = _socket_onmessage;
    _socket.onclose = _socket_onclose;
  };

  // Handle any errors that occur.
  var _socket_onerror = function (error) {
    var message = 'WebSocket error: ' + error;
    console.error(message);
    // Close the socket, just in case.
    _socket.close();
    // Reconnect!
    setTimeout(connect_to_live_tweets, _config['websocket_retry_connection_interval']);
  };

  // Show a connected message when the WebSocket is opened.
  var _socket_onopen = function (event) {
    var message = 'Connected to: ' + _endpoint;
    console.log(message);
    //socketStatus.className = 'open';
  };

  // Handle messages sent by the server.
  var _socket_onmessage = function (event) {
    var message = event.data;
    //console.log('Message: ' + message);
    try {
      var obj = JSON.parse(message);
      received_tweet(obj);
    } catch (e) {
      console.error('Failed to parse tweet: ' + e.message);
    }
  };

  // Show a disconnected message when the WebSocket is closed.
  var _socket_onclose = function (event) {
    var message = 'WebSocket disconnected from ' + _endpoint;
    console.log(message);
    //socketStatus.className = 'closed';
    // Reconnect!
    setTimeout(connect_to_live_tweets, _config['websocket_retry_connection_interval']);
  };

  var animate_insertion_fading = function ($element) {
    $element.animate(
      { opacity: 1.0 },
      {
        duration: 1000,
        complete: function() {
          // Complete.
          console.log('Added 1 - fading.');
        }
      }
    );
  };

  var animate_insertion_width = function ($element, final_width) {
    $element.animate(
      { width: final_width },
      {
        duration: 1000,
        complete: function() {
          // Complete.
          console.log('Added 1 - width='+final_width);
        }
      }
    );
  };

  var animate_removal_width = function ($element, is_inserting_new) {
    var $new_tweet_item = is_inserting_new ? clone_tweet_template() : null;
    // TODO(jweyrich): Figure out why we need the +30 here.
    var original_width = $element.width() + 30;
    //console.log('original_width=' + original_width);
    $element.animate(
      { width:'toggle' },
      {
        duration: 500,
        complete: function() {
          console.log('Removed 1.');
          $(this).remove();
          if (is_inserting_new) {
            var $last_tweet_item = $(".tweets-row > .tweet-item:last");
            $new_tweet_item.width(0);
            $new_tweet_item.insertAfter($last_tweet_item);
            animate_insertion_width($new_tweet_item, original_width);
          }
        }
      }
    );
    return is_inserting_new ? $new_tweet_item : null;
  };

  var clone_tweet_template = function () {
    var $cloned_element = $('.tweets-row > .tweet-template-native > .tweet-item').clone();
    $cloned_element.find('blockquote')
      .removeClass('twitter-tweet-DUMMY').addClass('twitter-tweet');
    return $cloned_element;
  };

  var track_and_update_tweet_timestamps = function () {
    setTimeout(track_and_update_tweet_timestamps, 1000);

    $(".tweets-panel").find('.tweets-row > .tweet-item').each(function (i, elem) {
      var $when = $(elem).find('.when');
      var timestamp = $when.attr('data-timestamp');
      update_tweet_timestamp($when, timestamp);
    });
  };

  var update_tweet_timestamp = function ($element, timestamp) {
    // Example of obj.tweet.created_at: "Thu Apr 07 14:18:36 +0000 2016"
    var displayDate = moment(new Date(timestamp)).fromNow();
    $element.text(displayDate);
  };

  var set_tweet_data_native = function ($element, obj) {
    twttr.widgets.createTweet(
      obj.tweet.id_str,
      $element[0],
      {
        align: 'left'
      }
    ).then(function (el) {
      //console.log("Tweet has been displayed.");
    });
  };

  var set_tweet_data_custom = function ($element, obj) {
    if (obj.tweet.user.screen_name) {
      var $author = $element.find('.author');
      $author.text(obj.tweet.user.screen_name);
    }
    if (obj.tweet.text) {
      var $message = $element.find('.message');
      $message.text(obj.tweet.text);
    }
    if (obj.tweet.created_at) {
      var $when = $element.find('.when');
      $when.attr('data-timestamp', obj.tweet.created_at);
      update_tweet_timestamp($when, obj.tweet.created_at);
    }
    if (obj.sentiment) {
      var $score = $element.find('.score');
      $score.text(obj.sentiment.score);
      //$score.text('TESTING');
      $score.css('display', 'block');
    }
  };

  var set_tweet_data = function ($element, obj) {
    set_tweet_data_native($element, obj);
    //set_tweet_data_custom($element, obj);
  };

  var contains_badword = function (tweet_text) {
    for (var i = 0; i < _badwords_regex.length; i++) {
      var unaccented = removeDiacritics(tweet_text);
      var re = _badwords_regex[i];
      //console.log('re = ' + re + ', unaccented = ' + unaccented);
      var result = unaccented.match(re);
      if (result) {
        //console.log('Matched: ' + result);
        return true;
      }
    }
    return false;
  };

  var received_tweet = function (tweet_obj) {
    var tweet_text = tweet_obj.tweet.text;
    if (contains_badword(tweet_text)) {
      console.log('Discaring tweet from @' + tweet_obj.tweet.user.screen_name + ' due to badwords: ' + tweet_text);
      return;
    }

    _queued_tweets.push(tweet_obj);
    console.log('Queued a new tweet: ' + _queued_tweets.length + ' queued');
  };

  function track_and_update_visible_tweets() {
    if (!_state['updating'])
      return;

    setTimeout(track_and_update_visible_tweets, _config['update_interval']);

    if (_queued_tweets.length === 0)
      return;

    var count = _visible_tweets.length;

    console.log('Presenting a new tweet! Was showing exactly ' + count);

    var new_tweet_obj = _queued_tweets.shift(); // Remove first element.

    _visible_tweets.push(new_tweet_obj);

    if (count < _config['max_visible_tweets']) {
      var $last_tweet_item = $(".tweets-panel").find('.tweets-row > .tweet-item:last, .tweets-row > .tweet-template-native').last();

      var $new_tweet_item = clone_tweet_template();
      set_tweet_data($new_tweet_item, new_tweet_obj);
      
      $new_tweet_item.css('opacity', 0);
      $new_tweet_item.insertAfter($last_tweet_item);
      animate_insertion_fading($new_tweet_item);
    } else {
      var $tweet_to_remove = $(".tweets-row > .tweet-item:first");

      var $new_tweet_item = animate_removal_width($tweet_to_remove, true);
      set_tweet_data($new_tweet_item, new_tweet_obj);

      _visible_tweets.shift(); // Remove first element.

      var extra = _visible_tweets.length - _config['max_visible_tweets'];
      //console.log('Removing ' + extra + ' extra tweets');
      for (var i=0; i<extra; i++) {
        $tweet_to_remove = $tweet_to_remove.next();
        animate_removal_width($tweet_to_remove, false);
        _visible_tweets.shift(); // Remove more elements.
      }
    }
  };

  var _badwords_regex = [];

  // Pre-build a RegExp object for each badword in order to
  // avoid creating it for every test.
  var build_badwords_filters = function () {
    var complete_list = global_badwords.concat([
      'DILMA',
      'CUNHA',
      'PSDB',
    ]);

    for (var i = 0; i < complete_list.length; i++) {
      _badwords_regex.push(new RegExp(complete_list[i], 'ig'));
    }
  };
  
  populate_config_form();
  track_and_update_visible_tweets();
  track_and_update_tweet_timestamps();
  connect_to_live_tweets();
  build_badwords_filters();
});