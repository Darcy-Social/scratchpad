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
	  let url = $('#origin').text()+'/public/darcy/post-'+new Date().toISOString()+'.md';

    solid.auth.fetch(
      url,
      {method: 'PUT', headers:{'Content-Type': 'text/plain'}, body: window.localStorage['content'] }
      ).
      then(response => {
          if (response == 'Created'){  
		if (response == 'Created'){  
          if (response == 'Created'){  
              delete window.localStorage['content'];
          }
          updateUI();
          notifyDarcy(url );
      }).
      catch(error => {
        alert('Error:'+ error);
        updateUI();
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


// new api stuff

/**
 * returns a nice url-compatible date string
 * @param {Date} date 
 */
function ts(date){
  date = date || new Date;
  return date.toISOString().replace(/:/g,'.');
}
  


/**
 * gets all the darcy posts in a pod
 * the pod must point to the root of the pod, and include a slash
 * @param {String} pod 
 * 
 * example : getPosts( "https://gaia.solid.community/" ).then( contents =>{ console.log(contents);});
 */
function getPosts(pod){

  const LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
  let store = $rdf.graph();

  const fetcher = new $rdf.Fetcher(store);

  let folder = $rdf.sym(pod+"public/darcy/posts/");

  return new Promise(function(resolve,reject){
      fetcher.load(folder).then(() => {
          folderItems = store.each(
              folder,
              LDP("contains"),
              null
          );

          resolve(folderItems);
      });
  });
}



// 
/**
 * posts a new comment to a pod
 * the pod must point to the root of the pod, and include a slash
 * @param {String} pod 
 * @param {String} text 
 * 
 * example : publishPost( "https://gaia.solid.community/","test api!" ).then( response =>{ console.log(response);});
 */
function publishPost(pod,text){

  let url = pod+'/public/darcy/posts/post-'+ts()+'.md';

  return new Promise(function(resolve,reject){
      solid.auth.fetch(
          url,
          {method: 'PUT', headers:{'Content-Type': 'text/plain'}, body: text }
          ).
      then(response => {
          //console.log("ok we got a response");
          //console.log(response);
          if (response && response['statusText'] == 'Created'){  
              resolve(response);
          }
          reject(response)

      });
    });
}
                                                                       
