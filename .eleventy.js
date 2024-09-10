/* Markdown plugins */
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItVideo = require("markdown-it-video");
const { html5Media } = require('markdown-it-html5-media');
const markdownItAttrs = require('markdown-it-attrs');

/* Other plugins */
const pluginTOC = require('eleventy-plugin-toc');
const pluginSEO = require("eleventy-plugin-seo");
const pluginSASS = require("eleventy-sass");
const pluginSitemap = require("@quasibit/eleventy-plugin-sitemap");
const pluginNavigation = require("@11ty/eleventy-navigation");
const pluginFavicon = require("./_scripts/favicon");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginHTMLValidate = require('eleventy-plugin-html-validate');
const fetchPhotos = require('./_scripts/photos');
const fetchEvents = require('./_scripts/calendar');
const { EleventyHtmlBasePlugin  } = require("@11ty/eleventy");
const { EleventyI18nPlugin } = require("@11ty/eleventy");
const eleventyVue = require("@11ty/eleventy-plugin-vue");

const { DateTime } = require("luxon");
const fs = require('fs');
const nunjucks = require("nunjucks");
const markdown = require('nunjucks-markdown');
require('dotenv').config();
const _ = require("lodash");

module.exports = function (el) {
  /* Vue */
  el.addPlugin(eleventyVue, {
    cacheDirectory: ".cache/vue/",
    input: [],
  });
  
  /* Passthrough Copy */
  el.addPassthroughCopy("fonts");
  el.addPassthroughCopy("CNAME");
  el.addPassthroughCopy("scripts");
  el.addPassthroughCopy({
    "./node_modules/dhtmlx-scheduler/codebase/dhtmlxscheduler_material.css": "./css/vendor/dhtmlxscheduler_material.css",
    "./node_modules/dhtmlx-scheduler/codebase/dhtmlxscheduler.js": "./scripts/vendor/dhtmlxscheduler.js",
    "./node_modules/dhtmlx-scheduler/codebase/dhtmlxscheduler.js.map": "./scripts/vendor/dhtmlxscheduler.js.map"
  });

  el.setDataDeepMerge(true);

  /* SEO */
  el.addPlugin(pluginSEO, require("./_data/seo.json"));
  el.addPlugin(pluginSitemap, {
    sitemap: {
      hostname: 'https://www.vubdivingcenter.be',
    },
  });
  el.addPlugin(pluginFavicon);
  el.addPlugin(pluginRss);
  el.addPlugin(pluginHTMLValidate);
  el.addPlugin(EleventyHtmlBasePlugin, {
    baseHref: ''
  });
  el.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: "nl", // Required, this site uses "en"
  });

  /* Navigation */
  el.addPlugin(pluginNavigation);

  /* Markdown */
  const md = markdownIt({ html: true });
  md.use(markdownItAnchor);
  md.use(markdownItVideo, {
    youtube: { width: 640, height: 390 },
  });
  md.use(html5Media);
  md.use(markdownItAttrs, {
    leftDelimiter: '{',
    rightDelimiter: '}',
    allowedAttributes: []
  });
  el.setLibrary("md", md);
  el.addPlugin(pluginTOC, {
    tags: ['h2'],
    ul: true
  });

  /* Stylesheets */
  el.addPlugin(pluginSASS, [
    {
      compileOptions: {
        permalink: function (permalinkString, inputPath) {
          return (data) => {
            return data.page.filePathStem.replace(/^\/_scss\//, "/css/") + ".css";
          };
        }
      },
      sass: {
        style: "expanded",
        sourceMap: true
      }
    }, {
      rev: true,
      when: { ELEVENTY_ENV: "stage" }
    }, {
      sass: {
        style: "compressed",
        sourceMap: false
      },
      rev: true,
      when: [{ ELEVENTY_ENV: "production" }, { ELEVENTY_ENV: false }]
    }
  ]);

  /* Nunjucks */
  let njkEnv = new nunjucks.Environment(
    new nunjucks.FileSystemLoader("_includes")
  );
  markdown.register(njkEnv, (src, _) => {
    return md.render(src);
  });
  el.setLibrary("njk", njkEnv);


  /* Collections */
  el.addCollection("posts_year", (collection) => {
    return _.chain(collection.getFilteredByTag("posts").sort((a, b) => a.date - b.date))
      .groupBy((post) => post.date.getFullYear())
      .toPairs()
      .reverse()
      .value();
  });
  el.addCollection("documents", () => {
    const data = fs.readFileSync('./documents/documents.json', 'utf8');
    return JSON.parse(data);
  });
  el.addPlugin(fetchPhotos);
  el.addPlugin(fetchEvents);

  el.addFilter("readableDate", dateObj => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc', locale: 'nl' }).toFormat("cccc, dd LLL yyyy");
  });

  // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  el.addFilter('htmlDateString', (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('yyyy-LL-dd');
  });

  // Get the first `n` elements of a collection.
  el.addFilter("head", (array, n) => {
    if (n < 0) {
      return array.slice(n);
    }
    return array.slice(0, n);
  });

  el.addFilter("after", (posts) => {
    const filterDate = new Date(Date.now() - (3 * 31 * 24 * 60 * 60 * 1000));
    return posts.filter(post => {
      return post.date.getTime() > filterDate.getTime();
    });
  });

  el.addFilter("min", (...numbers) => {
    return Math.min.apply(null, numbers);
  });

  el.addShortcode('excerpt', post => {
    post.excerpt = extractExcerpt(post);
    return post.excerpt; 
  });

  el.setBrowserSyncConfig({
    callbacks: {
      ready: function (_, browserSync) {
        const content_404 = fs.readFileSync('_site/404.html');
        browserSync.addMiddleware("*", (req, res) => {
          // Provides the 404 content without redirect.
          res.write(content_404);
          res.end();
        });
      },
    },
    ui: false,
    ghostMode: false
  });

  return {
    templateFormats: [
      "ico",
      "njk",
      "jpg",
      "md",
      "html",
      "liquid",
      "svg",
      "png",
      "pdf",
      'gif',
      "mp4"
    ],
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: {
      layouts: "_layouts",
    },
  };
};

const excerptMinimumLength = 64;
const excerptSeparator = '<!--more-->'

/**
 * Extracts the excerpt from a document.
 *
 * @param {*} doc A real big object full of all sorts of information about a document.
 * @returns {String} the excerpt.
 */
function extractExcerpt(doc) {
  if (!doc.hasOwnProperty('templateContent')) {
    console.warn('Failed to extract excerpt: Document has no property `templateContent`.');
    return;
  }

  const content = doc.templateContent;

  if (content.includes(excerptSeparator)) {
    return content.substring(0, content.indexOf(excerptSeparator)).trim();
  }
  else if (content.length <= excerptMinimumLength) {
    return content.trim();
  }

  const excerptEnd = findExcerptEnd(content);
  return content.substring(0, excerptEnd).trim();
}

/**
 * Finds the end position of the excerpt of a given piece of content.
 * This should only be used when there is no excerpt marker in the content (e.g. no `<!--more-->`).
 *
 * @param {String} content The full text of a piece of content (e.g. a blog post)
 * @param {Number?} skipLength Amount of characters to skip before starting to look for a `</p>`
 * tag. This is used when calling this method recursively.
 * @returns {Number} the end position of the excerpt
 */
function findExcerptEnd(content, skipLength = 0) {
  if (content === '') {
    return 0;
  }

  const paragraphEnd = content.indexOf('</p>', skipLength) + 4;

  if (paragraphEnd < excerptMinimumLength) {
    return paragraphEnd + findExcerptEnd(content.substring(paragraphEnd), paragraphEnd);
  }

  return paragraphEnd;
}
