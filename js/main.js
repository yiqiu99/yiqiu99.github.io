$(function () {
    // resize window
    $(window).resize(function () {
        if ($(window).width() < 1280 && $(window).width()>540) {
            $(".page").css({"width": $(window).width() - $(".side-card").width() - 90, "float": "left"})
        } else {
            $(".page").removeAttr("style")
        }
    });

    // menu
    $(".menus_icon").click(function () {
        if ($(".header_wrap").hasClass("menus-open")) {
            $(".header_wrap").removeClass("menus-open").addClass("menus-close")
        } else {
            $(".header_wrap").removeClass("menus-close").addClass("menus-open")
        }
    })

    $(".m-social-links").click(function () {
        if ($(".author-links").hasClass("is-open")) {
            $(".author-links").removeClass("is-open").addClass("is-close")
        } else {
            $(".author-links").removeClass("is-close").addClass("is-open")
        }
    })

    $(".site-nav").click(function () {
        if ($(".nav").hasClass("nav-open")) {
            $(".nav").removeClass("nav-open").addClass("nav-close")
        } else {
            $(".nav").removeClass("nav-close").addClass("nav-open")
        }
    })

    $(document).click(function(e){
        var target = $(e.target);
        if(target.closest(".nav").length != 0) return;
        $(".nav").removeClass("nav-open").addClass("nav-close")
        if(target.closest(".author-links").length != 0) return;
        $(".author-links").removeClass("is-open").addClass("is-close")
        if((target.closest(".menus_icon").length != 0) || (target.closest(".menus_items").length != 0)) return;
        $(".header_wrap").removeClass("menus-open").addClass("menus-close")
    })

    // 显示 cdtop
    $(document).ready(function ($) {
        var offset = 100,
            scroll_top_duration = 700,
            $back_to_top = $('.nav-wrap');

        $(window).scroll(function () {
            ($(this).scrollTop() > offset) ? $back_to_top.addClass('is-visible') : $back_to_top.removeClass('is-visible');
        });

        $(".cd-top").on('click', function (event) {
            event.preventDefault();
            $('body,html').animate({
                scrollTop: 0,
            }, scroll_top_duration);
        });
    });

    // pjax
    // Collapse the homepage "News" list after the first few items
    function foldNews() {
        var NEWS_VISIBLE = 3;
        var heading = document.getElementById('news');
        if (!heading) return;
        var list = heading.nextElementSibling;
        while (list && list.tagName !== 'UL') list = list.nextElementSibling;
        if (!list || list.dataset.folded) return;
        var items = list.children;
        if (items.length <= NEWS_VISIBLE) return;
        list.dataset.folded = '1';
        var hidden = items.length - NEWS_VISIBLE;
        for (var i = NEWS_VISIBLE; i < items.length; i++) items[i].classList.add('news-older');
        list.classList.add('news-collapsed');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'news-toggle';
        btn.textContent = 'Show older news (' + hidden + ')';
        btn.addEventListener('click', function () {
            var collapsed = list.classList.toggle('news-collapsed');
            btn.textContent = collapsed ? 'Show older news (' + hidden + ')' : 'Show less';
        });
        list.parentNode.insertBefore(btn, list.nextSibling);
    }
    foldNews();

    $(document).pjax('a[target!=_blank]','.page', {
        fragment: '.page',
        timeout: 5000
    });
    $(document).on({
        'pjax:click': function() {
            $('body,html').animate({
                scrollTop: 0,
            }, 700);
        },
        'pjax:end': function() {
            foldNews();
            if ($(".header_wrap").hasClass("menus-open")) {
                $(".header_wrap").removeClass("menus-open").addClass("menus-close")
            }
            if ($(".author-links").hasClass("is-open")) {
                $(".author-links").removeClass("is-open").addClass("is-close")
            }
            if ($(".nav").hasClass("nav-open")) {
                $(".nav").removeClass("nav-open").addClass("nav-close")
            }
        }
    });

    // smooth scroll
    $(function () {
        $('a[href*=\\#]:not([href=\\#])').click(function () {
            if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
                var target = $(this.hash);
                target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
                if (target.length) {
                    $('html,body').animate({
                        scrollTop: target.offset().top
                    }, 700);
                    return false;
                }
            }
        });
    });

})