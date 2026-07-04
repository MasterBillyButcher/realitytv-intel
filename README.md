<div align="center">
<img src="img/logo-banner.png" alt="Reality TV Intel" width="600"/>
</div>

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Montserrat&weight=900&size=19&duration=2600&pause=900&color=A78BFA&center=true&vCenter=true&width=650&lines=%F0%9F%8E%AC+Bigg+Boss+%C2%B7+Lock+Upp+%C2%B7+Khatron+%C2%B7+and+More;%F0%9F%93%8A+Followers+%C2%B7+Rankings+%C2%B7+Growth+%E2%80%94+One+Place;%E2%9A%A1+Fast+%C2%B7+Static+%C2%B7+Always+Up+to+Date" alt="Typing SVG"/>

<br/><br/>

[![Live Site](https://img.shields.io/badge/🌐_Open_Live_Site-realitytv--intel.vercel.app-7C3AED?style=for-the-badge&labelColor=0d0221)](https://realitytv-intel.vercel.app/)
&nbsp;
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&labelColor=0d1117)](https://github.com/MasterBillyButcher/realitytv-intel)

<br/>

![](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![](https://img.shields.io/badge/Status-Live-22C55E?style=flat-square)

</div>

---

## 📊 What You Can Do

<div align="center">

| 🏆 Rankings | 📈 Growth | 📸 Live Refresh | 📇 Bio Profiles | 📤 Export |
|:-----------:|:---------:|:---------------:|:----------------:|:---------:|
| Cross-show follower leaderboard | Before → Last → Current tracking | Real Instagram counts via Apify | Full contestant profiles, one tap | CSV, PNG, PDF, JSON |

</div>

Every show gets a **Roster** table, a **Card View**, and a **Growth** tracker — filterable by status, gender, or search, and screenshot-ready from any of the three.

---

## 🚀 Getting Started

```bash
git clone https://github.com/MasterBillyButcher/realitytv-intel.git
open public/index.html
```

Or just visit **[realitytv-intel.vercel.app](https://realitytv-intel.vercel.app/)** — no setup needed to browse.

---

## 🔧 Required Environment Variables

Vercel → your project → **Settings → Environment Variables** — add these, then redeploy:

| Variable | Used for | Notes |
|---|---|---|
| `APIFY_TOKEN` | Live Instagram follower refresh | Supports multiple keys: `token1,token2,token3` (comma-separated, one per Apify account) — automatically fails over to the next if one runs dry on its monthly free credit |
| `ADMIN_PASSWORD` | Admin login | Plaintext value, verified server-side only — never ships to the browser |
| `ADMIN_SESSION_SECRET` | Signs the admin session cookie | Any long random string; you'll never type it again after setup |

Admin auth is fully server-side: the password is checked by `api/verify-admin.js`, and login state is a signed `httpOnly` cookie the browser can't be tricked into forging from devtools.

---

## ✏️ Updating Data (Admin)

1. **🔒 Admin** → enter password → **✎ Edit Mode**
2. Click any cell to edit directly, or **+ Add** a new contestant
3. **↓ Save JSON** → downloads `data.js`
4. Push that file to `public/data/data.js` on GitHub → everyone sees it on their next load

**Bulk follower import** — paste into Export → Bulk Follower Import, matched by exact Instagram handle (not name, to avoid updating the wrong person):
```
@gauravkhannaofficial, kkk, 2.1M
@rubinadilaik, kkk, 8.6M
```

**Live refresh** — Export panel → **🔄 Refresh Followers (Live)**, whole-roster or per-show. Pulls real counts through a server-side Apify proxy — costs roughly $0.10–0.15 for a full 46-contestant refresh, well inside Apify's free $5/month credit even done daily. One-time setup: authorize the actor once at [apify.com/apify/instagram-followers-count-scraper](https://apify.com/apify/instagram-followers-count-scraper) (click Start, accept pricing — required once per Apify account, not something this site can skip).

> **Live refresh and Bulk Import only ever touch "Current."** They never auto-shift into "Last Checked" — that's deliberate, so refreshing daily doesn't quietly erase your last real checkpoint. When you want a new checkpoint, use **⟳ Roll Current → Last Checked** in the Growth tab yourself, on your own schedule.

**Copy a contestant to another show** — 📋 button on any contestant (Card view or Roster). Duplicates their entire record — photo, bio, follower history, socials — into a different show as an independent new entry. The original is never touched; useful for contestants who appear on more than one show at once.

**Contestant bio profiles** — the ℹ️ Profile button (Card view) or clicking a name (Roster) opens a full write-up: early life, career, reality TV history, personal life, trivia. Content is sanitized before rendering, so it's safe even if bio HTML ever comes from a less-trusted source.

---

## 👥 Who Can Do What

<div align="center">

| | 🌐 Visitor | 🔐 Admin |
|:--|:---------:|:--------:|
| Browse, search, filter | ✅ | ✅ |
| View bio profiles | ✅ | ✅ |
| Export CSV / screenshot / PDF | ✅ | ✅ |
| Edit contestants, manage shows | ❌ | ✅ |
| Live Instagram refresh | ❌ | ✅ |
| Copy contestant between shows | ❌ | ✅ |

</div>

---

## ⌨️ Shortcuts

<div align="center">

| `Ctrl S` | `Ctrl Shift S` | `Ctrl Shift P` | `Esc` |
|:--------:|:--------------:|:--------------:|:-----:|
| 💾 Save | 📥 Download | 🖨️ Print | ✖️ Close |

</div>

---

## 🌍 Works On

<div align="center">

[![Chrome](https://img.shields.io/badge/Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![Edge](https://img.shields.io/badge/Edge-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://www.microsoft.com/edge)
[![Firefox](https://img.shields.io/badge/Firefox-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://www.mozilla.org/firefox/)
[![Safari](https://img.shields.io/badge/Safari-006CFF?style=for-the-badge&logo=safari&logoColor=white)](https://www.apple.com/safari/)

</div>

---

## 🔧 Quick Fixes

<details>
<summary><b>Updates not showing on the live site?</b></summary>
Confirm the file landed at exactly <code>public/data/data.js</code> on the <code>main</code> branch, then hard refresh <code>Ctrl+Shift+R</code>. If it's still stale, check your browser console for a 404 on <code>data.js</code> — that usually means the GitHub username/repo in <code>dataloader.js</code> doesn't match the real repo.
</details>

<details>
<summary><b>Screenshot/capture blank or wrong size?</b></summary>
Usually a cross-origin photo issue — try a different show, or re-host any contestant photos that consistently break captures. <code>Ctrl+P → Save as PDF</code> works as a fallback for any panel.
</details>

<details>
<summary><b>Live refresh failing?</b></summary>
Check <code>APIFY_TOKEN</code> is set in Vercel and the actor's been authorized at least once in your Apify account (see setup note above). The error toast text usually says exactly which of the two it is.
</details>

<details>
<summary><b>Warning banner about GitHub?</b></summary>
Make sure the repo is set to <b>Public</b> on GitHub — private repos 404 on the raw-file fetch this site depends on.
</details>

---

## 📄 License · MIT

<div align="center">

**[🌐 realitytv-intel.vercel.app](https://realitytv-intel.vercel.app/)** &nbsp;·&nbsp; **[⭐ Star on GitHub](https://github.com/MasterBillyButcher/realitytv-intel)**

Built with ❤️ by BobMasterBillie

</div>
