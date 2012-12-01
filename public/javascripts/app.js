_.templateSettings = {
    evaluate    : /\{%([\s\S]+?)%\}/g,
    interpolate : /\{\{(.+?)\}\}/g,
    escape : /\{\{\{(.+?)\}\}\}/g
};

$(document).ready(function(){
    var getLocation = function(){
        return JSON.parse($.cookie("ra_location"));
    }

    $(document).on("click", ".goback", function(){
        window.history.back(); //back buttons go back in history
    });

    var AppRouter = Backbone.Router.extend({ 
        routes: {
            "": "events",
            "tomorrow": "tomorrow",
            "date/:id": "events",
            "locations": "locations", //locations view
            "event/:id": "getEvent",
            "dates": "dates",
            "dj/:name": "dj"
        },
     
        events: function(date) {
            $(".date-selection .ui-btn-active").removeClass("ui-btn-active");
            if (date) {
                $(".date-selection .calendar").addClass("ui-btn-active");
            } else {
                $(".date-selection .todayName").addClass("ui-btn-active");
            }
            //TODO in the future we should force reloading the model when a new location cookie is set
            var me = this;
            eventsView.update(date, function(){
                me.changePage(eventsView);    
            });
        },

        tomorrow : function(){
            $(".date-selection .ui-btn-active").removeClass("ui-btn-active");
            $(".date-selection .tomorrowName").addClass("ui-btn-active");
            var me = this;
            var currentDate = new Date();
            var tomorrow = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
            var day = tomorrow.getDate(); if(day<10) day = "0" + day;
            var month = tomorrow.getMonth() + 1; if(month<10) month = "0" + month;
            var year = tomorrow.getFullYear();
            var dateStr = "" + day + month + year;

            // app_router.navigate("",  {trigger: true});
            eventsView.update(dateStr, function(){
                me.changePage(eventsView);
            });
        },

        locations: function() {
            var me = this;
            locationsView.update();
            me.changePage(locationsView);
        },
     
        getEvent: function(id) {
            var me = this;
            $.mobile.showPageLoadingMsg();
            eventView.update(id, function(){
                me.changePage(eventView);
            });
        },

        dates: function(){
            this.changePage(datesView);
        },

        dj: function(name){
            var me = this;
            djView.update(name, function(){
                me.changePage(djView);
            });
        },
     
        changePage:function (page) {
            $.mobile.changePage(page.$el, {transition:"none", changeHash: false});
        }
    });


    //----------------MODELS
    var Event = Backbone.Model.extend({
        urlBase: '/event/',

        initialize: function(id){
            this.id = id; //thought it was automatic?
        },

        url: function(){
            return this.urlBase + this.id
        },

        toJSON: function(){
            //sanitize href's with '#' so the backboune Router can intercept them
            var baseJSON = Backbone.Model.prototype.toJSON.apply(this, arguments);
            _.each(baseJSON.extraInfo, function(value, key){
                var tempDiv = $("<div/>");
                tempDiv.html(value);
                tempDiv.find("[href]").each(function(index, el){
                    var $this = $(this);
                    var theHref = $this.attr("href");
                    $this.attr('href', "#" + theHref);
                });
                baseJSON.extraInfo[key] = tempDiv.html();
            });
            return baseJSON;
        }
    });

    var Events = Backbone.Collection.extend({
      urlBase: '/events/',

      setDate: function(date){
        this.date = date;
      },

      url: function(){
        return this.urlBase + this.date;
      }
    });

    var Locations = Backbone.Collection.extend({
      url: '/regions/'
    });


    var Dj = Backbone.Model.extend({
      urlBase: '/dj/',

      url: function(){
        return this.urlBase + this.get("name");
      }
    });

    var Locations = Backbone.Collection.extend({
      url: '/regions/'
    });

 

    //------------VIEWS---------------------------//
    //1-Events (landing page ATM)
    var EventsView = Backbone.View.extend({
        el: "#eventsPage",
        template: _.template($("#events-template").html()),

        events: {
            'tap .calendar' : 'pickDate'
        },

        initialize: function(date){
            this.model = new Events();
        },

        update: function(date, callback){
            var me = this;
            var currentDate = new Date();
            this.date = currentDate;
            this.day = date ? date.substr(0,2) : currentDate.getDate();
            this.month = date ? date.substr(2,2) : currentDate.getMonth() + 1; //lame. so lame.
            this.year = date ? date.substr(4,4) : currentDate.getFullYear();
            var dateStr = "" + this.day + this.month + this.year;

            this.model.setDate(dateStr);

            //init models... TODO no need to fetch them every time
            var isTonight;
            if (date) {
                isTonight = false;
            } else {
                isTonight = true;
            }
            this.model.fetch({
                success: function(model, response, options){
                    me.render({
                        isTonight: isTonight
                    });
                    callback();
                }
            });
        },

        pickDate: function(evt){
            this.datepicker.tap();
        },

        getDate: function(){
            if(!this.date){
                var date = new Date();
                return {
                    date: date,
                    day: ""+date.getDate(),
                    month: date.getMonth() + 1,
                    year: ""+date.getFullYear()
                }
            } else {
                return {
                    date: this.date,
                    day: this.day,
                    month: this.month,
                    year: this.year
                }
            }
        },

        render: function(options) {
            var dateStr = this.day + "/"+ this.month + "/" + this.year;
            var locationData = $.parseJSON($.cookie("ra_location"));
            if (locationData.name=="All Regions") {
                locationData.name = locationData.country; //no use in displaying "All Regions"
            }
            var events = this.model.toJSON(); 
            _.each(events, function(event){
                event.title = event.title || 'N/A'
            });
            var todayNum = new Date().getDay();
            var daysMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            this.$(".todayName .ui-btn-text").html(daysMap[todayNum]);
            this.$(".tomorrowName .ui-btn-text").html(daysMap[(todayNum+1)%7]);
            var tmpHtml = this.template({
                location: locationData,
                events: events,
                date: dateStr,
                isTonight: options.isTonight
            });

            $content = this.$el.find("[data-role=content]");
            $content.html(tmpHtml);

            var me = this;
            this.datepicker = this.$( "#datePicker");
            this.datepicker.mobipick({
                change: function(evt){
                    var date = $( this ).val();
                    var dateObject = $( this ).mobipick( "option", "date" );
                    var day = date.split("-")[2];
                    var month = date.split("-")[1];
                    var year = date.split("-")[0];
                    var dateStr = day+month+year;
                    app_router.navigate("date/"+dateStr,  {trigger: true});
                },
                cancel: function(evt){
                    var route = Backbone.history.fragment;
                    //http://stackoverflow.com/questions/8550841/trigger-same-location-route
                    if(route == ""){
                        Backbone.history.loadUrl(route);
                    } else {
                        app_router.navigate("",  {trigger: true});
                    }
                }
            });
            this.datepicker.change(function(evt){
                var date = $( this ).val();
                // JavaScript Date object
                var dateObject = $( this ).mobipick( "option", "date" );
            });

            // $.mobile.initializePage();
            $content.trigger('create'); //jqueryMobile init
            // $("#mainFooter").hide();
        }
    });

    //2-Event
    var EventView = Backbone.View.extend({
        el: "#eventPage",
        template: _.template($("#event-template").html()),

        initialize: function(){
            this.model = new Event();
        },

        update: function(id, callback){
            var me = this;
            this.model.set({id: id});
            //init models... TODO no need to fetch them every time
            this.model.fetch({
                complete: function(){
                    me.render();
                    callback();
                }
            });

        },

        render: function() {
            var eventJSON = this.model.toJSON();
            var tmpHtml = this.template(eventJSON);

            this.$el.find("h1.title").html(eventJSON.title);
            $content = this.$el.find("[data-role=content]");
            $content.html(tmpHtml);
            // $.mobile.initializePage();
            $content.trigger('create'); //jqueryMobile init
        },

        cleanView: function(){
            this.$el.html(""); //hack to avoid superimposing event pages
            this.$el.closest("#eventPage").find("h1.title").html("");
        }
    });

    //3 - Locations
    var LocationsView = Backbone.View.extend({
        el: "#locationsPage",
        template: _.template($("#locations-template").html()),
        events: {
            "click #locationSubmit" : "setLocation",
            "change #countrySelect" : "changeCountry"
        },

        initialize: function(date){
            this.model = new Locations();
        },

        update: function(callback){
            if (this.isLoaded) return;
            var me = this;
            this.model.fetch({
                success: function(model, response, options){
                    me.render();
                }
            });
            this.isLoaded = true;
        },

        changeCountry: function(evt){
            var country = $(evt.currentTarget).val();
            this.render(country);
        },

        setLocation: function(evt){
            var $el = $(evt.currentTarget);
            var $country = $("#countrySelect");
            var $region = $("#regionSelect");
            var location = {
                id: $region.children("option:selected").data("id"),
                country: $country.val(),
                name: $region.children("option:selected").data("name"),
                img: $country.children("option:selected").data("img")
            }
            var locationStr = JSON.stringify(location);
            $.cookie('ra_location', locationStr);
            app_router.navigate("",  {trigger: true});
            $.mobile.showPageLoadingMsg();
        },

        render: function(country) {
            var currentCountry = country || getLocation().country;
            var currentRegion = getLocation().name;
            var allRegions = this.model.toJSON();
            var countryRegions = _.find(allRegions, function(country){
                return country.name == currentCountry;
            }).regions;
            var tmpHtml = this.template({
                currentCountry: currentCountry,
                currentRegion: currentRegion,
                countryRegions: countryRegions,
                regions: allRegions
            });
            $content = this.$el.find("[data-role=content]");
            $content.html(tmpHtml);

            // $.mobile.initializePage();
            $content.trigger('create'); //jqueryMobile init
            this.delegateEvents();
        }
    });

    //4 - Dates
    var DatesView = Backbone.View.extend({
        el: "#datesPage",
        template: _.template($("#dates-template").html()),
        events: {
            "click #dateok": "chooseDate",
            "click #datecancel": "cancelDate",
            "click #tonight": "chooseTonight"
        },

        initialize: function(date){
            var monthsArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            var days = [];
            for(var i =0; i<31; i++){
                days.push(i+1);
            }
            var years = [2011, 2012, 2013];
            this.render({
                months: monthsArray,
                days: days,
                years: years,
                selectedDate: eventsView.getDate()
            });
            this.$day = $("#select-choice-day");
            this.$month = $("#select-choice-month");
            this.$year = $("#select-choice-year");
        },

        chooseDate: function(){
            var dayVal = "" + this.$day.children(":checked").not(".null").index();
            if (dayVal.length==1) dayVal = "0" + dayVal;
            var monthVal = "" + this.$month.children(":checked").not(".null").index();
            if (monthVal.length==1) monthVal = "0" + monthVal;
            var yearVal = this.$year.children(":checked").not(".null").val();
            if (dayVal && monthVal && yearVal) {
                dateStr = "" + dayVal + monthVal + yearVal;
                $.mobile.showPageLoadingMsg();
                app_router.navigate("date/" + dateStr,  {trigger: true});
            }
        },

        cancelDate: function(){
            window.history.back();
        },

        chooseTonight: function(){
            app_router.navigate("",  {trigger: true});
            $.mobile.showPageLoadingMsg();
        },

        render: function(data) {
            var tmpHtml = this.template(data);
            $content = this.$el.find("[data-role=content]");
            $content.html(tmpHtml);

            // $.mobile.initializePage();
            $content.trigger('create'); //jqueryMobile init
            this.delegateEvents();
        }
    });

    //5 - Dj
    var DjView = Backbone.View.extend({
        el: "#djPage",
        template: _.template($("#dj-template").html()),
        events: {
        },

        initialize: function(date){
            this.model = new Dj;
        },

        update: function(name, callback){
            var me = this;
            this.model.set({name: name});
            this.model.fetch({
                success: function(model, response, options){
                    me.render();
                    callback();
                }
            });
        },

        render: function() {
            var modelJSON = this.model.toJSON();
            var tmpHtml = this.template(modelJSON);
            $content = this.$el.find("[data-role=content]");
            $content.html(tmpHtml);

            $content.trigger('create'); //jqueryMobile init
            this.delegateEvents();
        }
    });


    var locationsView = new LocationsView();
    var eventsView = new EventsView();
    var eventView = new EventView();
    var datesView = new DatesView();
    var djView = new DjView();


    var app_router = new AppRouter;
    Backbone.history.start();

});