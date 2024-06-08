import lume from "lume/mod.ts";
import { Data, Page } from "lume/core/file.ts";
import { safeLoad } from "https://deno.land/x/js_yaml_port@3.14.0/js-yaml.js";

import date from "lume/plugins/date.ts";
import feed from "lume/plugins/feed.ts";
import inline from "lume/plugins/inline.ts";
import metas from "lume/plugins/metas.ts";
import minifyHTML from "lume/plugins/minify_html.ts";
import modifyUrls from "lume/plugins/modify_urls.ts";
import nav from "lume/plugins/nav.ts";
import resolveUrls from "lume/plugins/resolve_urls.ts";
import sass from "lume/plugins/sass.ts";
import sitemap from "lume/plugins/sitemap.ts";
import slugify_urls from "lume/plugins/slugify_urls.ts";

import toc from "https://deno.land/x/lume_markdown_plugins@v0.7.0/toc.ts";

import anchor from "npm:markdown-it-anchor";
import footnote from "npm:markdown-it-footnote";
import callouts from "npm:markdown-it-obsidian-callouts";

const markdown = {
    options: {
        breaks: false,
        linkify: true,
        xhtmlOut: true
    }, plugins: [
        [callouts, {
            icons: {
                caution:
                    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
                important: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flame"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
                note: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
                tip: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lightbulb"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
                warning:
                    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
            }
        }],
        [anchor, { level: 2 }],
        footnote,
    ]
};

interface Project {
    name: string;
    home: string;
    repo: string;
    logo: string;
    wordmark: string;
    description: string;
    draft: boolean;
}

// -------------------
// Foundation Data: submodule pages
// - foundation.json is generated by ./.github/lastmod.ts
// - foundation.yml  is manually maintained: descriptions, resulting page url, etc.
const FOUNDATION_DATA: Record<string, unknown> = safeLoad(Deno.readTextFileSync("./site/_includes/foundation.json"));
const FOUNDATION_PAGES: Record<string, unknown> = safeLoad(Deno.readTextFileSync("./site/_includes/foundation.yml"));
const PROJECT_DATA: Record<string, Project> = safeLoad(Deno.readTextFileSync("./site/foundation/PROJECTS.yaml"));

const mergeFoundationPageData = (page: Page, allPages: Page<Data>[]) => {
    // Called below when preprocessing html
    // (after markdown processing has occurred, but before the page is rendered to html)
    // 1. merge the data from the foundation.json and foundation.yml files
    // 2. set the date to a Date object
    // 3. set the title to the first H1 in the content if it hasn't been set
    // 4. if the page matches a bylaws entry (_data/bylaws.yml), set that ordinal as a page attribute

    const srcPath = page.src.path.replace("/foundation/", "");
    const metaData = FOUNDATION_DATA[srcPath + ".md"] as Data;
    const pageData = FOUNDATION_PAGES[srcPath] as Data;

    if (!pageData || !metaData) {
        // Skip/Remove any pages that don't have a corresponding entry in the foundation.yml file
        console.log("IGNORE: No page data for", srcPath);
        allPages.splice(allPages.indexOf(page), 1);
        return;
    }

    page.data = {
        ...page.data,
        ...metaData,
        ...pageData,
    };
    page.data.date = new Date(page.data.date);
    page.data.cssclasses = (metaData.cssclasses || []).concat(pageData.cssclasses || []);

    // If the title hasn't been set, set it to the first H1 in the content
    // Add the link to the github page based on the src path
    if (!page.data.title) {
        const content = page.data.content as string;
        const match = content.match(/#\s(.*)$/m); // 'm' flag for multiline
        if (match) {
            page.data.title = match[1];
        } else {
            page.data.title = page.data.basename;
        }
    }

    // Is this a page in the bylaws? Copy that ordinal into the page metadata if so
    const entry = page.data.bylaws.nav.find((x: { href: string }) => x.href === page.data.url);
    if (entry) {
        page.data.ord = entry.ord;
    }
};

const fixFoundationUrls = (url: string) => {
    if (url.startsWith('http') || url.startsWith('#')) {
        return url;
    }
    // Replace references to CONTACTS.yaml with the URL from the foundation repo
    if (url.includes('CONTACTS.yaml')) {
        return 'https://github.com/commonhaus/foundation/blob/main/CONTACTS.yaml';
    }
    // Replace references to project templates with the URL from the foundation repo
    if (url.includes('../../templates')) {
        return url.replace('../../templates', 'https://github.com/commonhaus/foundation/blob/main/templates');
    }
    // remaining links to CONTRIBUTING.md (from foundation materials) should point to the foundation repo
    if (url.includes('CONTRIBUTING.md')) {
        return 'https://github.com/commonhaus/foundation/blob/main/CONTRIBUTING.md';
    }
    // remaining links to CONTRIBUTING.md (from foundation materials) should point to the foundation repo
    if (url.includes('CODE_OF_CONDUCT.md')) {
        return 'https://github.com/commonhaus/foundation/blob/main/CODE_OF_CONDUCT.md';
    }
    return url;
};

// -------------------
// Site Configuration

const site = lume({
    src: "site",
    dest: "public",
    prettyUrls: false,
    location: new URL("https://www.commonhaus.org")
}, { markdown });

site.ignore("foundation/node_modules", "foundation/templates");

// Copy the content of "static" directory to the root of your site
site.copy("static", "/");
site.mergeKey("cssclasses", "stringArray");

site
    .use(date())
    .use(inline(/* Options */))
    .use(metas())
    .use(toc())
    .use(nav())
    .use(resolveUrls())
    .use(modifyUrls({
        fn: fixFoundationUrls
    }))
    .use(slugify_urls({
        extensions: [".html"],
        replace: {
            "&": "and",
            "@": "",
        },
    }))
    .use(sass({
        includes: "_includes/scss",
        format: "compressed",
        options: {
            sourceMap: false,
            sourceMapIncludeSources: true,
        }
    }))
    .use(sitemap({
        query: "metas.robots!=false",
    }))
    .use(minifyHTML({
        options: {
            keep_closing_tags: true,
            keep_html_and_head_opening_tags: true,
            keep_spaces_between_attributes: true,
        }
    }))
    .use(feed({
        output: ["/feed/index.rss", "/feed/index.json"],
        query: "post",
        limit: 10,
        info: {
            title: "=metas.site",
            description: "=description",
        },
        items: {
            title: "=rss-title",
            published: "=date",
            updated: "=updated",
        },
    }))
    .use(feed({
        output: ["/feed/notice.rss", "/feed/notice.json"],
        query: "post notice",
        limit: 10,
        info: {
            title: "=metas.site",
            description: "=description",
        },
        items: {
            title: "=rss-title",
            published: "=date",
            updated: "=updated",
        },
    }));

// Fixup attributes at build time if necessary
site.preprocess(['.md'], (pages) => {
    for (const page of pages) {
        if (typeof page.data.content !== "string") {
            continue;
        }
        if (/^\/activity\/\d/.test(page.src.path)) {
            page.data.cssclasses = page.data.cssclasses || [];
            page.data.cssclasses.push('activity', 'has-aside');
        }
        if (page.src.path.startsWith("/foundation")) {
            const regex = /(send an email to|email|be directed to) the \[`?.+?`? mailing list\]\[CONTACTS.yaml\]/g;
            const replacement = '[use our online form](https://forms.gle/t2d4DR6CxXSag26s5)';
            const content = page.data.content as string;
            page.data.content = content.replace(regex, replacement);
        }
        // add function to get list of projects
        page.data.listProjects = () => {
            return Object.values(PROJECT_DATA)
                .filter((project) => !project.draft);
        }
        page.data.archiveByYear = () => {
            if (!page.data.indexQuery) {
                return [];
            }
            // Group posts matching the given query by year
            const allPosts = site.search.pages(page.data.indexQuery, "date=desc");
            const postsByYear: Record<string, Data[]> = {};
            if (allPosts.length > 0) {
                allPosts.forEach((post) => {
                    const year = new Date(post.date).getFullYear();
                    if (!postsByYear[year]) {
                        postsByYear[year] = [];
                    }
                    postsByYear[year].push(post);
                });
            }
            return {
                years: Object.keys(postsByYear).sort((a, b) => Number(b) - Number(a)),
                posts: postsByYear
            };
        }
        page.data.indexBySection = () => {
            const allPosts = site.search.pages("", "url");
            const postsBySection: Record<string, Data[]> = {};
            if (allPosts.length > 0) {
                allPosts.forEach((post) => {
                    const section = post.url.substring(1, post.url.indexOf('/', 1));
                    if (!postsBySection[section]) {
                        postsBySection[section] = [];
                    }
                    postsBySection[section].push(post);
                });
            }

            return {
                list: Object.keys(postsBySection).sort(),
                posts: postsBySection
            };
        }
    }
});

site.preprocess([".html"], (filteredPages, allPages) => {
    for (const page of filteredPages) {

        if (page.src.path.startsWith("/foundation")) {
            mergeFoundationPageData(page, allPages);
        } else if (page.data.date && page.data.updated) {
            // For OTHER pages (actions, vote results),
            // set a boolean value if the updated date is different from the published date
            page.data.hasUpdate = page.data.date.toDateString() !== page.data.updated.toDateString();
        }
    }
});

site.filter("pageLock", (page: Page) => {
    let result = '';
    if (page.data.pinned) {
        result += `<span aria-label="pinned">${page.data.svg.pin}</span> `;
    }
    if (page.data.closedAt) {
        result += `<span aria-label="closed">${page.data.svg.closed}</span> `;
    }
    if (page.data.lockReason) {
        result += `<span aria-label="locked">${page.data.svg.lock}</span> `;
    }
    return result ? `<span class="act-status-icon">${result}</span>` : '';
});

site.filter("postLock", (data: Record<string, unknown>) => {
    let result = '';
    const svg = data.svg as any;
    if (data.pinned) {
        result += `<span aria-label="pinned">${svg.pin}</span> `;
    }
    if (data.closedAt) {
        result += `<span aria-label="closed">${svg.closed}</span> `;
    }
    if (data.lockReason) {
        result += `<span aria-label="locked">${svg.lock}</span> `;
    }
    return result ? `<span class="act-status-icon">${result}</span>` : `<span class="act-status-icon">${svg.blank}</span>`;
});

site.filter("testLock", (page: Page) => {
    return `<span class="act-status-icon">
    <span aria-label="pinned">${page.data.svg.pin}</span>
    <span aria-label="closed">${page.data.svg.closed}</span>
    <span aria-label="locked">${page.data.svg.lock}</span>
    </span>`;
});

site.filter("authorAvatar", (page: Page) => {
    const login = page.data.author;
    const author = page.data.authors[login];
    if (author) {
        return `<a class="avatar" href="${author.url}" target="_top">
            <img src="${author.avatar}" />
            <span>${login}</span>
        </a>`;
    } else {
        return `<div class="avatar">${login}</div>\n`;
    }
});

site.filter("listVoters", (voters: unknown) => {
    if (voters && Array.isArray(voters)) {
        return voters
            .map((voter: { login: string; url: string; }) =>
                `<a href="${voter.url}" target="_top">${voter.login}</a>`)
            .join(", ");
    } else {
        console.log(voters, "is not an array");
    }
});

export default site;