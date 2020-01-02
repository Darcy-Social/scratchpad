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


// new api stuff


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

  let folder = $rdf.sym(darcyRootPath(pod)+"post/");

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

  let url = getDarcyPostURL(pod,ts());

  return new Promise(
    function(resolve,reject){
      solid.auth.fetch( url, {method: 'PUT', headers:{'Content-Type': 'text/plain'}, body: text } ).
        then(response => {
          if (response && response['statusText'] == 'Created'){  
              resolve(response);
              return;
          }
          reject(response)

      });
    });
}

function publishComment(pod,originalContentURL,text){

  let slug = ts();
  let urlComment = getDarcyCommentURL(pod,slug);
  let URLReferenceToComment = getDarcyPingbackURL(originalContentURL,pod,slug,'comment');

  return new Promise(function(resolve,reject){
      solid.auth.fetch(
        urlComment,
        {method: 'PUT', headers:{'Content-Type': 'text/plain'}, body: text }
        ).
      then(response => {
        if (response && response['statusText'] == 'Created'){  
            console.log("ok, we created a comment, let's notify the post owner")
            if (URLReferenceToComment){
              return solid.auth.fetch(
                URLReferenceToComment,
                {method: 'PUT', headers:{'Content-Type': 'text/plain'}, body: urlComment }
                );
            }


        }
        else {
          reject(response)
        }
      });

    });
}

/**
 * used to generate the local url to store the pod owner's own comments.
 * used with getDarcyPingbackURL() to post pingbacks on a different pod
 * 
 * @param {*} pod 
 * @param {*} slug 
 */
function getDarcyCommentURL(pod,slug){
  return getDarcyContentURL(pod, slug, 'comment');
}
function getDarcyPostURL(pod,slug){
  return getDarcyContentURL(pod, slug, 'post');
}

/**
 * DO NOT USE FOR PINGBACKS
 * @param {*} pod 
 * @param {*} slug 
 * @param {*} type 
 */
function getDarcyContentURL(pod,slug,type){
  type = stabilizeURLFragment(type);
  slug = stabilizeURLFragment(slug);

  let path = (type == 'post') ? 'post' : 'activity';
  return darcyRootPath(pod)+path+'/'+slug+'.'+type;
}

function stabilizeURLFragment(fragment){
  return fragment.replace(/[^a-z0-9.-]/gi,'-');
}




/**
 * generates a pingback url to PUT to the original content pod
 * @param {*} originalContentURL 
 * @param {*} pod 
 * @param {*} slug 
 * @param {*} pingbackType 
 * 
 * getDarcyPingbackURL("https://giulio.solid.community/public/darcy/post/2020-01-02T14.50.54.892Z.post", "https://gaia.solid.community/",ts(),"comment" )
 */

function getDarcyPingbackURL(originalContentURL,pod,slug,pingbackType){
  let backlinkFilename = url_domain(pod)+'_'+stabilizeURLFragment(slug)+'_'+stabilizeURLFragment(pingbackType);

  //find the slug of the original content to create an activity folder for it
  let ocFileName = originalContentURL.slice(originalContentURL.lastIndexOf('/')+1);
  if (!ocFileName){ return null; }
  return darcyRootPath(getPodFromPodPath(originalContentURL))+"activity/"+ocFileName+'/'+backlinkFilename;
}


function getDarcyContentURLFromDarcyPingbackURL(pingbackURL){
  let elements = pingbackURL.slice(pingbackURL.lastIndexOf('/')+1).split('_');
  if (elements.length != 3){ return null; }
  return getDarcyContentURL("https://"+elements[0], elements[1], elements[2]);
}



/**
 * grabs the webids this person has as so-called friends
 * might be worth to cache the result
 *  
 * @param {String} webid 
 * 
 * example: listFriends("https://gaia.solid.community/profile/card#me").then(console.log);
 */
function listFriends(webid){
  const store = $rdf.graph();
  const fetcher = new $rdf.Fetcher(store);

  return fetcher.load(webid).then(
    () => {
      return store.each($rdf.sym(webid), FOAF('knows'))
    }
  );
};

/**
 * resolves a webid's name
 * @param {String} webid 
 * 
 * example: getName("https://jollyorc.solid.community/profile/card#me").then( console.log);
 * 
 */
async function getName(webid){
  const store = $rdf.graph();
  const fetcher = new $rdf.Fetcher(store);
  await fetcher.load(webid);
  const fullName = store.any($rdf.sym(webid), FOAF('name'));
  return ( fullName && fullName.value || friend.value);
  
}


function darcyRootPath(pod){
  return pod+'public/darcy/'
}
function getPodFromWebid(webid){
  return getPodFromPodPath(webid);
}

function getPodFromPodPath(path){
  return 'https://'+url_domain(path)+'/';
}

function url_domain(url) {
  var    a      = document.createElement('a');
         a.href = url;
  return a.hostname;
}

/**
 * returns a nice url-compatible date string
 * @param {Date} date 
 */
function ts(date){
  date = date || new Date;
  return date.toISOString().replace(/:/g,'.');
}



console.assert(
  getDarcyPingbackURL("https://giulio.solid.community/public/darcy/post/2020-01-02T14.50.54.892Z.post", "https://gaia.solid.community/","foo!","comment" )
    ==
  "https://giulio.solid.community/public/darcy/activity/2020-01-02T14.50.54.892Z.post/gaia.solid.community_foo-_comment",
  "pingback urls not generated correctly");