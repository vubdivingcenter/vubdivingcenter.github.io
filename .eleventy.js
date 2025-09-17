/* Markdown plugins */
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItVideo from "markdown-it-video";
import { html5Media } from 'markdown-it-html5-media';
import markdownItAttrs from 'markdown-it-attrs';

/* Other plugins */
import pluginTOC from 'eleventy-plugin-toc';
import pluginSEO from "eleventy-plugin-seo";
import pluginSASS from "eleventy-sass";
import pluginSitemap from "@quasibit/eleventy-plugin-sitemap";
import pluginNavigation from "@11ty/eleventy-navigation";
import pluginFavicon from "./_scripts/favicon.js";
import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginHTMLValidate from 'eleventy-plugin-html-validate';
import { fetchPhotos } from './_scripts/photos.js';
import { fetchEvents } from './_scripts/calendar.js';
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import { EleventyI18nPlugin } from "@11ty/eleventy";

import { DateTime } from "luxon";
import fs from 'fs';
import nunjucks from "nunjucks";
import markdown from 'nunjucks-markdown';
import dotenv from 'dotenv';
import _ from "lodash";

const seoConfig = JSON.parse(fs.readFileSync('./_data/seo.json', 'utf8'));
const vdcConfig = JSON.parse(fs.readFileSync('./_data/vdc.json', 'utf8'));

dotenv.config();

export default function (el) {
  /* Passthrough Copy */
  el.addPassthroughCopy("fonts");
  el.addPassthroughCopy("CNAME");
  el.addPassthroughCopy("scripts");
  el.addPassthroughCopy({
    "./node_modules/dhtmlx-scheduler/codebase/dhtmlxscheduler.css": "./css/vendor/dhtmlxscheduler.css",
    "./node_modules/dhtmlx-scheduler/codebase/dhtmlxscheduler.js": "./scripts/vendor/dhtmlxscheduler.js",
    "./node_modules/dhtmlx-scheduler/codebase/dhtmlxscheduler.js.map": "./scripts/vendor/dhtmlxscheduler.js.map"
  });

  el.setDataDeepMerge(true);

  /* SEO */
  el.addPlugin(pluginSEO, seoConfig);
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

  // Make VDC data available globally
  el.addGlobalData("vdc", vdcConfig);
  
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
      sass: {
        style: "compressed",
        sourceMap: false
      },
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
  
  el.setServerOptions({
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "Origin, X-Requested-With, Content-Type, Accept",
    },
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
 * @param {Number?} skipLength Amount of characters to skip before starting to look for a `</p>` tag.
 * This is used when calling this method recursively.
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
