var SynoPhotoCardVersion="0.0.1";

import {
  LitElement,
  html,
  css
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

import "https://unpkg.com/dayjs@1.11.7/dayjs.min.js?module";
import "https://unpkg.com/dayjs@1.11.7/plugin/customParseFormat.js?module";
import "https://unpkg.com/dayjs@1.11.7/plugin/relativeTime.js?module";

class SynoPhotoCard extends LitElement {

  //#region LitElement required functions

  set hass(hass) {
    this._hass = hass;
    
    if (this.resources == null)
      this._loadResources(this);
  }

  static get properties() {
    return {
      _hass: {},
      config: {},
      resources: {},
      selectedDate: {}
    };
  }

  static get styles() {
    return css`
      .content {
        overflow: hidden;
      }
      .content hui-card-preview {
        max-width: 100%;
      }
      ha-card {
        height: 100%;
        overflow: hidden;
      }
      .btn-reload {
        float: right;
        margin-right: 25px;
        text-align: right;
      }
      figcaption {
        text-align:center;
        white-space: nowrap;
        height: 40px;
      }
      img, video {
        width: 100%;
        object-fit: contain;
      }
      .resource-viewer .btn {
        position: absolute;
        transform: translate(-50%, -50%);
        -ms-transform: translate(-50%, -50%);
        background-color: #555;
        color: white;
        font-size: 16px;
        padding: 12px 12px;
        margin-top: -25px;
        border: none;
        cursor: pointer;
        border-radius: 5px;
        opacity: 0;
        transition: opacity .35s ease;
      }
      .resource-viewer:hover .btn {
        opacity: 1;
      }
      .resource-viewer .btn-left {
        left: 0%;
        margin-left: 25px;
      }
      .resource-viewer .btn-right {
        right: 0%;
        margin-right: -10px
      }
      figure.selected {
        opacity: 0.5;
      }
      .duration {
        font-style:italic;
      }
        
      /* The Modal (background) */
      .modal {
        display: none; /* Hidden by default */
        position: fixed; /* Stay in place */
        z-index: 1; /* Sit on top */
        padding-top: 100px; /* Location of the box */
        left: 0;
        top: 0;
        width: 100%; /* Full width */
        height: 100%; /* Full height */
        overflow: auto; /* Enable scroll if needed */
        background-color: rgb(0,0,0); /* Fallback color */
        background-color: rgba(0,0,0,0.9); /* Black w/ opacity */
      }
      /* Modal Content (Image) */
      .modal-content {
        margin: auto;
        display: block;
        width: 95%;
      }
      /* Caption of Modal Image (Image Text) - Same Width as the Image */
      #popupCaption {
        margin: auto;
        display: block;
        width: 80%;
        max-width: 700px;
        text-align: center;
        color: #ccc;
        padding: 10px 0;
        height: 150px;
      }
      /* Add Animation - Zoom in the Modal */
      .modal-content, #popupCaption {
        animation-name: zoom;
        animation-duration: 0.6s;
      }
      @keyframes zoom {
        from {transform:scale(0)}
        to {transform:scale(1)}
      }
      /* 100% Image Width on Smaller Screens */
      @media only screen and (max-width: 700px){
        .modal-content {
          width: 100%;
        }
      }
      /* DEBUG window */
      #debugTrace {
        display: block;
        width: auto;
        height: 150px;
        overflow-y: scroll;
      }
    `;
  }

  render() {    
    const menuAlignment = (this.config.menu_alignment || "responsive").toLowerCase();
    
    return html`
        ${this.errors == undefined ? html`` :
         this.errors.map((error) => {
          return html`<hui-warning>${error}</hui-warning>`
         })}
        <ha-card .header=${this.config.title} class="menu-${menuAlignment}">
          ${this.resources == undefined || !(this.config.show_reload ?? false) ?
            html`` : html`<ha-progress-button class="btn-reload" @click="${ev => this._reloadResources(this)}">Reload</ha-progress-button>` }
          <div class="resource-viewer" @touchstart="${ev => this._handleTouchStart(ev)}" @touchmove="${ev => this._handleTouchMove(ev)}">
            <figure style="margin:5px;">
              ${
                this._currentResource().isImage ?
                html`<img @click="${ev => this._popupImage(ev)}" src="${this._currentResource().url}"/>` :
                html`<video controls ?loop=${this.config.video_loop} ?autoplay=${this.config.video_autoplay} src="${this._currentResource().url}#t=0.1" @loadedmetadata="${ev => this._videoMetadataLoaded(ev)}" @canplay="${ev => this._startVideo(ev)}"  preload="metadata"></video>`
              }
              <figcaption>${this._currentResource().caption} 
                ${this._currentResource().isImage ?
                  html`` : html`<span class="duration"></span> ` }                  
                ${!(this.config.show_zoom ?? false) ?
                  html`` : html`<a href= "${this._currentResource().url}" target="_blank">Zoom</a>` }                  
              </figcaption>
            </figure>  
            <button class="btn btn-left" @click="${ev => this._prevResource(ev)}">&lt;</button> 
            <button class="btn btn-right" @click="${ev => this._nextResource(ev)}">&gt;</button> 
          </div>
          <div id="imageModal" class="modal" @touchstart="${ev => this._handleTouchStart(ev)}" @touchmove="${ev => this._handleTouchMove(ev)}">
            <img class="modal-content" id="popupImage">
            <div id="popupCaption"></div>
          </div>
          ${!(this._debug ?? false) ?
            html`` : 
            html`<div id="debugTrace">
              ${this._tracelog.map((element) => {
                  return html`${element}<br /> `;
                }
              )}
            </div>`
          }
        </ha-card>
    `;
  }
 
  updated(changedProperties) {

    const arr = this.shadowRoot.querySelectorAll('img.lzy_img')
    arr.forEach((v) => {
        this.imageObserver.observe(v);
    })
    const varr = this.shadowRoot.querySelectorAll('video.lzy_video')
    varr.forEach((v) => {
        this.imageObserver.observe(v);
    })
    // changedProperties.forEach((oldValue, propName) => {
    //   this._trace(` - ${propName} changed. oldValue: ${oldValue}`);
    // });
  }

  setConfig(config) {
    dayjs.extend(dayjs_plugin_customParseFormat);
    dayjs.extend(dayjs_plugin_relativeTime);

    this.imageObserver = new IntersectionObserver((entries, imgObserver) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const lazyImage = entry.target
                //console.log("lazy loading ", lazyImage)
                lazyImage.src = lazyImage.dataset.src
            }
        })
    });
    if (!config.entity && !config.entities) {
      throw new Error("Required configuration for entities is missing");
    }

    this.config = config;
    this._debug = (this.config.debug ?? false);
    if (this.config.entity) {
      if (!this.config.entities) {
        this.config = { ...this.config, entities: [] };
      }
      this.config.entities.push(this.config.entity);
      delete this.config.entity;
    }

    if (this._hass !== undefined)
      this._loadResources(this);
  }

  getCardSize() {
    return 1;
  }

  //#endregion


    // // render object
    // return {
    //   url: "",
    //   name: "",
    //   extension: "jpg",
    //   caption: isLoading ? "Loading resources..." : "No images or videos to display",
    //   index: 0
    // };
    

    // // resource object
    
    // resource = {
    //   url: fileRawUrl,
    //   base_url: fileUrl,
    //   name: fileName,
    //   extension: ext,
    //   caption: fileCaption,
    //   index: -1,
    //   date: date
    // };

    // // Promise build
    // return new Promise(async (resolve, reject) => { 
      
    //   resolve(values);
    // });


    // // Promise use
    // ref._lazyLoadFile(mediaItem).then(function(resource){
    // });  

  
  //#region Render methods
  _currentResource(){
    //isHass
    //name
    //extension -> isImage?
    //url
    //caption
    if (this.resources == null) {
      return { url: "", name: "", isImage: true, caption: "Initializing..." };
    } else if (this.resources.length == 0) {
      return { url: "", name: "", isImage: true, caption: "No images or videos are available." };
    } else if (this._currentResourceItem == null) {
      return { url: "", name: "", isImage: true, caption: "Resource loading..." };
    } else {
      return this._currentResourceItem;
    }

    return null;
  }

  _reloadResources(ref){
    ref._trace(`_reloadResources`);
    ref.resources = [];
    for (let index = 0; index < ref._domainUsers.length; index++) {
      const element = ref._domainUsers[index];
      if (typeof element.token == "string")
        ref._initItems(ref, element);
    }
  }
  
  _prevResource(event){
    if (this._prevResourceItems.length > 0) {
      this._currentResourceItem = this._prevResourceItems.pop();
    };
    // this will restart the interval
    this._startSlideShow(false);
  }
  _nextResource(event){
    // this will get the next image
    this._startSlideShow();
  }
  _handleTouchStart(event){

  }
  _handleTouchMove(event){

  }
  _popupCamera(event){

  }
  _popupImage(evt) {
    var modal = this.shadowRoot.getElementById("imageModal");    
    modal.style.display = "block";
    this._loadImageForPopup();
    modal.scrollIntoView(true);

    modal.onclick = function() {
      modal.style.display = "none";
    }
  }

  _videoMetadataLoaded(event){

  }
  _startVideo(event){

  }

  //#endregion

  //#region internal methods

  _debug = false;
  _tracelog = [];
  _trace(txt){
    if (this._debug){
      console.log(txt);
      this._tracelog.unshift(txt);
    }
  }

  _format(str, item) {
    var regex = /\$\{[^\}]+\}/g;
    var args = str.match(regex);

    args.forEach(a => {
      var path = a.substring(2, a.length - 1);
      var pathList = path.split('.');
      var val = item;
      pathList.forEach(p => {
        if (val != null)
          val = val[p];
      });

      if (path == "time" && val != null)
        val = new Date(val * 1000).toLocaleDateString();

      str = str.replace(a, val == null ? "" : val);
    });

    return str;
  }

  _domainUsers = [];
  _loadResources(ref){
    for (let index = 0; index < ref.config.entities.length; index++) {
      const element = ref.config.entities[index];
      const key = `${element.user}@${element.domain}`;
      let domainUser = ref._domainUsers.find(k => k.key == key);
      if (domainUser == undefined){
        domainUser = { key: key, domain: element.domain, type: 'timeline', token: true};
        ref._domainUsers.push(domainUser);
        ref._synoLogin(element.domain, element.user, element.pass)
        .then(function(data){
          domainUser.auth = { token: data?.synotoken, sid: data?.sid};
          ref._initItems(ref, domainUser);
        })
        .catch(function(error){
          domainUser.token = false;
        });
      } else if (domainUser.token == true) {
        // busy authorizing
      } else if (domainUser.token == false) {
        // authorizing failed
      } else {
        // we already have a token
      }
    }
  }
  _currentResourceItem;
  _prevResourceItems = [];
  _slideShowTimer = null;
  _startSlideShow(loadNext) {
    const ref = this;
    if (loadNext != false) ref._loadNextItem(ref); 
    if (ref._slideShowTimer) clearInterval(ref._slideShowTimer);

    if (this.config.slideshow_timer) {
      var time = parseInt(this.config.slideshow_timer);
      if (!isNaN(time) && time > 0) {
        ref._slideShowTimer = setInterval(() => {
          if (ref.resources != null){
            // Select next resource
            ref._loadNextItem(ref);
          }
        }, 
        (time * 1000));
      }
    }
  }

  _initItems(ref, domainUser) {
    if (domainUser.type == 'timeline'){
      ref._synoBrowseTimeline(domainUser.domain, domainUser.auth)
      .then(function(data){
        if (ref.resources == null) ref.resources = [];
        const processedLists = [];
        for (let i = 0; i < data.length; i++) {
          const list = data[i].list;
          for (let j = 0; j < list.length; j++) {
            const element = list[j];
            if (!processedLists[`${element.year}${element.month}`]){
              processedLists[`${element.year}${element.month}`] = true;
              ref.resources.push({
                entity: domainUser,
                starttime: new Date(element.year, element.month-1).getTime()/1000,
                endtime: new Date(element.year, element.month).getTime()/1000,
                count: element.item_count
              });
            }
          }
        }
        ref._trace(`_initItems #${ref.resources.length}`);
        if (ref._slideShowTimer == null) 
          ref._startSlideShow();
      })
      .catch(function(error){
        ref._trace(error);
      });

    }
  }

  _loadNextItem(ref) {
    const item = ref.resources[Math.floor(Math.random() * ref.resources.length)];
    const index = Math.floor(Math.random() * item.count);
    ref._trace(`_loadNextItem ${index} from ${item.starttime} - ${item.endtime} (${item.count})`);

    // Keep max items in cache
    if (ref._prevResourceItems.length > 5) ref._prevResourceItems.shift();
    if (ref._prevResourceItems.push(ref._currentResourceItem))
    
    ref._synoBrowseItem(item.entity.domain, item.entity.auth, index, item.starttime, item.endtime)
    .then(function(data){
      ref._getItem(ref, item.entity, data);
    })
    .catch(function(error){
      ref._trace(error);
    });
  }

  _getItem(ref, entity, item) {
    ref._synoGetImage(entity.domain, entity.auth, item)
    .then(function(url){
      var caption = item.filename;
      var format = ref.config.caption_format;
      if (format != null) 
        caption = ref._format(format, item);

      ref._currentResourceItem = { url: url, name: item.filename, isImage: item?.type == "photo", caption: caption };
    })
    .catch(function(error){
      ref._trace(error);
    });
  }

  _loadImageForPopup() {
    var modal = this.shadowRoot.getElementById("imageModal");
    var modalImg = this.shadowRoot.getElementById("popupImage");
    var captionText = this.shadowRoot.getElementById("popupCaption");

    if (modal.style.display == "block") {
      modalImg.src = this._currentResource().url;
      captionText.innerHTML = this._currentResource().caption;
    }
  }
  
  //#endregion

  //#region Synology API

  _synoLogin(domain, user, pass){
    var ref = this;
    var apiUrl = `https://${domain}/webapi/entry.cgi?api=SYNO.API.Auth&version=6&method=login&account=${user}&passwd=${pass}&enable_syno_token=yes`;
    
    return new Promise(async (resolve, reject) => { 
      fetch(apiUrl, { method: 'GET', credentials: 'include' })
        .then(response => { 
          if (!response.ok) 
            throw new Error('Network response was not ok');
           
          ref._trace(`_synoLogin: ${response.status}`);
          return response.json();
        })
        .then(data => {
          // Display data in an HTML element
          resolve(data?.data);
        })
        .catch(error => {
          ref._trace(`ERROR SYNO.API.Auth: ${error}`);
          reject(error);
        });
    });
  }

  _synoBrowseTimeline(domain, auth){
    var ref = this;
    var apiUrl = `https://${domain}/webapi/entry.cgi?api=SYNO.Foto.Browse.Timeline&version=2&method=get&timeline_group_unit=month&SynoToken=${auth.token}`;
    
    return new Promise(async (resolve, reject) => { 
      fetch(apiUrl, { method: 'GET', credentials: 'include' })
        .then(response => { 
          ref._trace(`_synoBrowseTimeline: ${response.status}`);
          if (!response.ok) 
            throw new Error('Network response was not ok');

          return response.json();
        })
        .then(data => {
          if (data?.success == true) {
            resolve(data.data?.section);
          } else {
            ref._trace(`ERROR SYNO.Foto.Browse.Timeline: ${data?.error?.code}`)
            reject(data?.error?.code);
          }
        })
        .catch(error => {
          ref._trace(`ERROR SYNO.Foto.Browse.Timeline: ${error}`);
          reject(error);
        });
    });
  }

  _synoBrowseItem(domain, auth, index, startTime, endTime){
    var ref = this;
    var additional = "[\"thumbnail\",\"address\",\"exif\",\"video_meta\"]";
    var apiUrl = `https://${domain}/webapi/entry.cgi?api=SYNO.Foto.Browse.Item&version=1&method=list&limit=1&offset=${index}&SynoToken=${auth.token}&start_time=${startTime}&end_time=${endTime}&additional=${additional}`;

    return new Promise(async (resolve, reject) => { 
      fetch(apiUrl, { method: 'GET', credentials: 'include' })
        .then(response => { 
          ref._trace(`_synoBrowseItem: ${response.status}`);
          if (!response.ok) 
            throw new Error('Network response was not ok');

          return response.json();
        })
        .then(data => {
          if (data?.success != true) {
            ref._trace(`ERROR SYNO.Foto.Browse.Item: ${data?.error?.code}`)
            reject(data?.error?.code);
          } else if (data.data?.list?.length == 0) {            
            ref._trace(`ERROR SYNO.Foto.Browse.Item: 0 items retrieved`)
            reject(-1);
          } else {  
            resolve(data.data.list[0]);
          }
        })
        .catch(error => {
          ref._trace(`ERROR SYNO.Foto.Browse.Item: ${error}`);
          reject(error);
        });
    });
  }

  _synoGetImage(domain, auth, item){
    var ref = this;
    var filename = item.filename;
    var id = item.id;
    var cacheKey = item.additional?.thumbnail?.cache_key;
    var apiUrl = `https://${domain}/webapi/entry.cgi/${filename}?id=${id}&cache_key=${cacheKey}&type=unit&size=xl&api=SYNO.Foto.Thumbnail&method=get&version=2&SynoToken=${auth.token}`;
    
    return new Promise(async (resolve, reject) => { 
      fetch(apiUrl, { method: 'GET', credentials: 'include' })
        .then(response => { 
          ref._trace(`_synoGetImage ${filename}: ${response.status}`);
          if (!response.ok) {
            reject(`${filename} response was not ok`);
          }
          return response.blob();
        })
        .then(blob => {
          if (blob?.size > 0) {
            resolve(URL.createObjectURL(blob));
          } else {
            ref._trace(`ERROR ${filename}: no data retrieved`)
            reject(-1);
          }
        })
        .catch(error => {
          ref._trace(`ERROR ${filename}: ${error}`);
          reject(error);
        });
    });
    }

  //#endregion

}
customElements.define("syno-photo-card", SynoPhotoCard);

console.groupCollapsed(`%cSYNO_PHOTO-CARD ${SynoPhotoCardVersion} IS INSTALLED`,"color: blue; font-weight: bold");
console.log("Readme:","https://github.com/bcolpaert/ha_syno-photo-card");
console.groupEnd();

window.customCards = window.customCards || [];
window.customCards.push({
  type: "syno-photo-card",
  name: "Synolgy Photos Card",
  preview: false, // Optional - defaults to false
  description: "The Synolgy Photos Card allows for viewing multiple images/videos available the Synology Photos." // Optional
});
