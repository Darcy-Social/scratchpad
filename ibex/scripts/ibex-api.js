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
  
  
  
  
/**
 * gets all the darcy comment URLs of a post
 * @param {String} postURL 
 * 
 * example : getComments("https://giulio.solid.community/public/darcy/post/2020-01-03TFOOOO.post").then(console.log);
 */
function getComments(postURL){

    const LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
    let store = $rdf.graph();
  
    const fetcher = new $rdf.Fetcher(store);
  
    let folder = $rdf.sym(getDarcyPingbackPath(postURL));
    console.log(folder);
  
    return new Promise(function(resolve,reject){
        fetcher.load(folder).then(() => {
            folderItems = store.each(
                folder,
                LDP("contains"),
                null
            ).map(t => { return resolvePingbackURL(t["value"])});
  
            resolve(folderItems);
        }).catch(()=>{ return []; });
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
  
  function fetchP(url, pars){
  
    return new Promise(
      function(resolve, reject) {
        solid.auth.fetch(
          url,
          pars
        ).then( response =>{
          if (!response || (response['statusText'] != 'Created' && response['statusText'] != 'OK')){
            console.log("result:"+ response['statusText'])
            reject(Error({ response: response}));
          } else {
            resolve(response);
          }
        })
      }
    );
  }
  
  function publishComment(pod,originalContentURL,text){
    let commentURL = getDarcyCommentURL(pod,ts());
    let pingbackFileName = getDarcyPingbackFileName(pod,ts(),"comment");
    let pingbackPath = getDarcyPingbackPath(originalContentURL);
    let [ocFolderName,activityPath] = basePath(pingbackPath);
  
    console.log("creating activity folder for post");
    fetchP(
      commentURL,
      {
        method: 'PUT',
        headers:{'Content-Type': 'text/plain'},
        body: text
      }
    ).then( response =>{
      console.log("local comment created, finding remote folder");
  
  
      return fetchP(pingbackPath).
      catch(()=>{
        console.log("we did not find the remote path, let's try to build a folder")
        return fetchP(
          activityPath,
          {
            method: 'POST',
            headers:{'Content-Type': 'text/turtle', 'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',"Slug": ocFolderName}
          }
        );
      });
    })
    .then( response =>{
      console.log("folder exists, creating file");
      return fetchP(
        pingbackPath,
        {
          method: 'POST',
          headers:{'Content-Type': 'text/plain',"Slug": pingbackFileName},
          body: commentURL
        });
      
  
    }).then( response =>{
      console.log("file created");
      console.log(response);
    }).catch( (e) =>{
      console.log(e);
      
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
  
    let pingbackPath = getDarcyPingbackPath(originalContentURL);
    if(!pingbackPath){ return null; }
  
    return pingbackPath+getDarcyPingbackFileName(pod,slug,pingbackType);
  }
  
  function getDarcyPingbackFileName(pod,slug,pingbackType){
    return "DARCY_"+url_domain(pod)+'_'+stabilizeURLFragment(slug)+'_'+stabilizeURLFragment(pingbackType)+".txt";
  }
  
  function getDarcyPingbackPath(originalContentURL){
    //find the slug of the original content to create an activity folder for it
    let ocFileName = originalContentURL.slice(originalContentURL.lastIndexOf('/')+1);
    if (!ocFileName){ return null; }
    return darcyRootPath(getPodFromPodPath(originalContentURL))+"activity/"+ocFileName+'/';
  }
  
  function resolvePingbackURL(pingbackURL){
    return getDarcyContentURLFromDarcyPingbackURL(pingbackURL);
  }
  
  function getDarcyContentURLFromDarcyPingbackURL(pingbackURL){
    let elements = pingbackURL.replace(/\.txt$/,'').slice(pingbackURL.lastIndexOf('/')+1).split('_');
    if (elements.length != 4){ return null; }
    if (elements[0] != "DARCY"){ return null; }
    
    return getDarcyContentURL("https://"+elements[1]+"/", elements[2], elements[3]);
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
  
  
  function basePath(path){
    const separator = "/";
    if (path.slice(-1) == separator){
      path = path.slice(0, -1);
    }
    const lastSeparatorPosition = path.lastIndexOf(separator);
  
    return [
      path.substr(lastSeparatorPosition + 1),
      path.substr(0, lastSeparatorPosition + 1),
    ];
  }
  
  
  console.assert(
    getDarcyPingbackURL("https://giulio.solid.community/public/darcy/post/2020-01-02T14.50.54.892Z.post", "https://gaia.solid.community/","foo!","comment" )
      ==
    "https://giulio.solid.community/public/darcy/activity/2020-01-02T14.50.54.892Z.post/DARCY_gaia.solid.community_foo-_comment.txt",
    "pingback urls not generated correctly");
  
  
  
  console.assert(
    getDarcyContentURLFromDarcyPingbackURL("https://giulio.solid.community/public/darcy/activity/2020-01-02T14.50.54.892Z.post/DARCY_gaia.solid.community_foo-_comment.txt")
      ==
    "https://gaia.solid.community/public/darcy/activity/foo-.comment",
    "pingback urls not resolved correctly");
  
  
  console.assert(
    getDarcyContentURLFromDarcyPingbackURL("DARCY_gaia.solid.community_foo-_comment")
      ==
    getDarcyContentURLFromDarcyPingbackURL("https://giulio.solid.community/public/darcy/activity/2020-01-02T14.50.54.892Z.post/DARCY_gaia.solid.community_foo-_comment.txt")
    
  )
  console.assert(
    getDarcyContentURLFromDarcyPingbackURL("DARCY_gaia.solid.community_foo-_comment")
      ==
    getDarcyContentURLFromDarcyPingbackURL("DARCY_gaia.solid.community_foo-_comment.txt")
    
  )