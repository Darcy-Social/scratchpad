const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');

// Log the user in and out on click
const popupUri = 'popup.html';
$('#loginbutton').click(() => solid.auth.popupLogin({ popupUri }));
$('#logoutbutton').click(() => {solid.auth.logout().then(()=>{ updateUI() })});
$('#logout').toggle();

let currentSession = null;
let commonmark = window.commonmark;

let reader = new commonmark.Parser({safe:true});
let writer = new commonmark.HtmlRenderer();

updateUI();

// Update components to match the user's login status
solid.auth.trackSession(session => {
  const loggedIn = !!session;
  currentSession = session;
  $('#login').toggle(!loggedIn);
  $('#logout').toggle(loggedIn);
  if (loggedIn) {
    $('#user').text(session.webId);
    
    $('#origin').text(new URL(session.webId).origin);
    // Use the user's WebID as default profile
    if (!$('#profile').val()){
      $('#profile').val(session.webId);
    }
  }
  updateUI();
  
});

function updateUI(){


  if (window.localStorage['content']){
    $('#createNewPost').hide();
    $('#publishNewPost').show();

    $('#blogtext').text(window.localStorage['content']);
  }
  else{
    $('#createNewPost').show();
    $('#publishNewPost').hide();
  }
  $.get('https://ibex.darcy.is/feed.php',function(data){ 
	  $('#feed').empty();

	  data.forEach(aPost => {
		  $('#feed').append(
        $('<div>').addClass('post').append($('<h4>').text(
          aPost['domain'] + ' '+aPost['last_update']),
        $('<div>').html( writer.render(reader.parse(aPost.body))  ) )  
    ) 
    })
  });
}


$('.newPost').click( () => {window.location = './editor.html'});

$('.publish').click(
  () => {

    if (!window.localStorage['content']){ return }

    let text = window.localStorage['content'];

    publishPost( $('#origin').text()+"/",text ).
      then( response =>{ console.log(response);
        delete window.localStorage['content'];
        console.log(response);
        updateUI();
        notifyDarcy(response.url );
      }).
      catch( response => {
        alert('Error:'+ response.status);
        console.log(response);
      });
  }
);


function notifyDarcy(url){
  $.post('https://ibex.darcy.is/feed.php', JSON.stringify( { url : url }), ()=>{ updateUI(); }); 
}

/*
btoa( // base64 so url-safe
        RawDeflate.deflate( // gzip
            unescape(encodeURIComponent( // convert to utf8
                editor.getValue()
            ))
        )
    );
    */


