(function () {
    'use strict';

    function create() {
        var html;
        var network = new Lampa.Reguest();

        this.create = function () {
            html = $("<div class=\"new-interface-info\">\n                <div class=\"new-interface-info__body\">\n                    <div class=\"new-interface-info__head\"></div>\n                    <div class=\"new-interface-info__title\"></div>\n                    <div class=\"new-interface-info__details\"></div>\n                    <div class=\"new-interface-info__description\"></div>\n                </div>\n            </div>");
        };

        this.update = function (data) {
            html.find('.new-interface-info__head').text('---');
            html.find('.new-interface-info__details').text('---');
            html.find('.new-interface-info__title').text(data.title);
            html.find('.new-interface-info__description').text(data.overview);
            
            Lampa.Background.change(Lampa.Api.img(data.backdrop_path, 'w200'));
            this.load(data);
        };

        this.draw = function (data) {
            var create = (data.release_date || data.first_air_date || '0000').slice(0, 4);
            var vote = parseFloat(data.vote_average + '').toFixed(1);
            var head = [];
            var details = [];
            var countries = Lampa.Api.sources.tmdb.parseCountries(data);
            var pg = Lampa.Api.sources.tmdb.parsePG(data);
            
            head.push('<span>' + create + '</span>');
            head.push(countries.join(', '));
            
            details.push('<div class="full-start__rate"><div>' + vote + '</div><div>TMDB</div></div>');
            details.push(data.genres.map(function (item) {
                return Lampa.Utils.capitalizeFirstLetter(item.name);
            }).join(' | '));
            details.push(Lampa.Utils.secondsToTime(data.runtime * 60, true));
            details.push('<span class="full-start__pg" style="font-size: 0.9em;">' + pg + '</span>');
            
            html.find('.new-interface-info__head').empty().append(head.join(', '));
            html.find('.new-interface-info__details').html(details.join('<span class="new-interface-info__split">&#9679;</span>'));
        };

        this.load = function (data) {
            var url = Lampa.TMDB.api((data.name ? 'tv' : 'movie') + '/' + data.id + '?api_key=' + Lampa.TMDB.key() + '&append_to_response=content_ratings,release_dates&language=' + Lampa.Storage.get('language'));
            
            network.silent(url, function (movie) {
                this.draw(movie);
            }.bind(this));
        };

        this.render = function () {
            return html;
        };

        this.empty = function () {};

        this.destroy = function () {
            html.remove();
            html = null;
        };
    }

    function component(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true,
            scroll_by_item: true
        });
        var items = [];
        var html = $('<div class="new-interface"><img class="full-start__background"></div>');
        var active = 0;
        var info;
        var lezydata;
        var viewall = Lampa.Storage.field('card_views_type') == 'view' || Lampa.Storage.field('navigation_type') == 'mouse';
        var background_img = html.find('.full-start__background');
        var background_last = '';

        this.create = function () {};

        this.empty = function () {
            var button = $('<div class="empty__footer"><div class="simple-button selector">' + Lampa.Lang.translate('change_source_on_cub') + '</div></div>');
            button.find('.selector').on('hover:enter', function () {
                Lampa.Storage.set('source', 'cub');
                Lampa.Activity.replace({
                    source: 'cub'
                });
            });

            var empty = new Lampa.Empty();
            html.append(empty.render(button));
            this.start = empty.start;
            this.activity.loader(false);
            this.activity.toggle();
        };

        this.loadNext = function () {
            if (this.next) {
                this.next_wait = true;
                this.next(function (new_data) {
                    this.next_wait = false;
                    new_data.forEach(this.append.bind(this));
                    Lampa.Layer.visible(items[active + 1].render(true));
                }.bind(this), function () {
                    this.next_wait = false;
                }.bind(this));
            }
        };

        this.push = function () {};

        this.build = function (data) {
            lezydata = data;
            info = new create(object);
            info.create();
            scroll.minus(info.render());
            
            data.slice(0, viewall ? data.length : 2).forEach(this.append.bind(this));
            
            html.append(info.render());
            html.append(scroll.render());

            Lampa.Layer.update(html);
            Lampa.Layer.visible(scroll.render(true));
            
            scroll.onEnd = this.loadNext.bind(this);
            scroll.onWheel = function (step) {
                if (!Lampa.Controller.own(this)) this.start();
                if (step > 0) this.down();
                else if (active > 0) this.up();
            }.bind(this);

            this.activity.loader(false);
            this.activity.toggle();
        };

        this.background = function (elem) {
            var new_background = Lampa.Api.img(elem.backdrop_path, 'w1280');
            
            background_img[0].onload = function () {
                background_img.addClass('loaded');
            };
            
            background_img[0].onerror = function () {
                background_img.removeClass('loaded');
            };
            
            background_last = new_background;
            background_img[0].src = background_last;
        };

        this.append = function (element) {
            var item = new Lampa.InteractionLine(element, {
                url: element.url,
                card_small: true,
                cardClass: element.cardClass,
                genres: object.genres,
                object: object,
                card_wide: true,
                nomore: element.nomore
            });
            
            item.create();
            item.onDown = this.down.bind(this);
            item.onUp = this.up.bind(this);
            item.onBack = this.back.bind(this);
            item.onToggle = function () {
                active = items.indexOf(item);
            };
            
            if (this.onMore) item.onMore = this.onMore.bind(this);
            
            item.onFocus = function (elem) {
                info.update(elem);
                this.background(elem);
            }.bind(this);
            
            item.onHover = function (elem) {
                info.update(elem);
                this.background(elem);
            }.bind(this);
            
            item.onFocusMore = info.empty.bind(info);
            
            scroll.append(item.render());
            items.push(item);
        };

        this.back = function () {
            Lampa.Activity.backward();
        };

        this.down = function () {
            active++;
            lezydata.slice(0, active + 2).forEach(this.append.bind(this));
            items[active].toggle();
            scroll.update(items[active].render());
        };

        this.up = function () {
            active--;
            items[active].toggle();
            scroll.update(items[active].render());
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                link: this,
                toggle: function toggle() {
                    if (items.length) {
                        items[active].toggle();
                    }
                },
                update: function update() {},
                left: function left() {
                    Navigator.move('left');
                },
                right: function right() {
                    Navigator.move('right');
                },
                up: function up() {
                    Navigator.move('up');
                },
                down: function down() {
                    Navigator.move('down');
                },
                back: this.back
            });
            Lampa.Controller.toggle('content');
        };

        this.refresh = function () {
            this.activity.loader(true);
            this.activity.need_refresh = true;
        };

        this.pause = function () {};

        this.stop = function () {};

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            network.clear();
            Lampa.Arrays.destroy(items);
            scroll.destroy();
            if (info) info.destroy();
            html.remove();
            items = null;
            network = null;
            lezydata = null;
        };
    }

    function startPlugin() {
        window.plugin_interface_ready = true;
        
        Lampa.InteractionMain = function (object) {
            return new component(object);
        };

        Lampa.Template.add('new_interface_style', "\n            <style>\n            .new-interface .card--small.card--wide {\n                width: 18.3em;\n            }\n            \n            .new-interface-info {\n                position: relative;\n                padding: 1.5em;\n                height: 24em;\n            }\n            \n            .new-interface-info__body {\n                width: 80%;\n                padding-top: 1.1em;\n            }\n            \n            .new-interface-info__head {\n                color: rgba(255, 255, 255, 0.6);\n                margin-bottom: 1em;\n                font-size: 1.3em;\n                min-height: 1em;\n            }\n            \n            .new-interface-info__head span {\n                color: #fff;\n            }\n            \n            .new-interface-info__title {\n                font-size: 4em;\n                font-weight: 600;\n                margin-bottom: 0.3em;\n                overflow: hidden;\n                -o-text-overflow: \".\";\n                text-overflow: \".\";\n                display: -webkit-box;\n                -webkit-line-clamp: 1;\n                line-clamp: 1;\n                -webkit-box-orient: vertical;\n                margin-left: -0.03em;\n                line-height: 1.3;\n            }\n            \n            .new-interface-info__details {\n                margin-bottom: 1.6em;\n                display: -webkit-box;\n                display: -webkit-flex;\n                display: -moz-box;\n                display: -ms-flexbox;\n                display: flex;\n                -webkit-box-align: center;\n                -webkit-align-items: center;\n                -moz-box-align: center;\n                -ms-flex-align: center;\n                align-items: center;\n                -webkit-flex-wrap: wrap;\n                -ms-flex-wrap: wrap;\n                flex-wrap: wrap;\n                min-height: 1.9em;\n                font-size: 1.1em;\n            }\n            \n            .new-interface-info__split {\n                margin: 0 1em;\n                font-size: 0.7em;\n            }\n            \n            .new-interface-info__description {\n                font-size: 1.2em;\n                font-weight: 300;\n                line-height: 1.5;\n                overflow: hidden;\n                -o-text-overflow: \".\";\n                text-overflow: \".\";\n                display: -webkit-box;\n                -webkit-line-clamp: 4;\n                line-clamp: 4;\n                -webkit-box-orient: vertical;\n                width: 70%;\n            }\n            \n            .new-interface .card-more__box {\n                padding-bottom: 95%;\n            }\n            \n            .new-interface .full-start__background {\n                height: 108%;\n                top: -6em;\n            }\n            \n            .new-interface .full-start__rate {\n                font-size: 1.3em;\n                margin-right: 0;\n            }\n            \n            .new-interface .card__promo {\n                display: none;\n            }\n            \n            .new-interface .card.card--wide+.card-more .card-more__box {\n                padding-bottom: 95%;\n            }\n            \n            .new-interface .card.card--wide .card-watched {\n                display: none !important;\n            }\n            \n            body.light--version .new-interface-info__body {\n                width: 69%;\n                padding-top: 1.5em;\n            }\n            \n            body.light--version .new-interface-info {\n                height: 25.3em;\n            }\n\n            body.advanced--animation:not(.no--animation) .new-interface .card--small.card--wide.focus .card__view{\n                animation: animation-card-focus 0.2s\n            }\n            body.advanced--animation:not(.no--animation) .new-interface .card--small.card--wide.animate-trigger-enter .card__view{\n                animation: animation-trigger-enter 0.2s forwards\n            }\n            </style>\n        ");
        
        $('body').append(Lampa.Template.get('new_interface_style', {}, true));
    }

    if (!window.plugin_interface_ready) startPlugin();

})();