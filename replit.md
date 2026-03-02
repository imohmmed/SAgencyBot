# منظومة التفاعل الرقمي - Telegram Bot Management Dashboard

## Overview
A full-stack Telegram bot management system with a web dashboard for administering an "electronic army" (digital engagement team). The system manages member registration, task distribution, and payment tracking.

## Architecture

### Backend
- **Express.js** server with TypeScript
- **Telegraf** for Telegram Bot API
- **PostgreSQL** database via Drizzle ORM
- Bot Token: `8516006670:AAF8bry6k6RYVPFfguhRmpp0NNhH5HYYOV4`
- Owner Telegram ID: `1384026800`
- Approval Group: `https://t.me/+C9Qk7j81KSdiODM6`
- Payment Group: `https://t.me/+wWAHO42c4wFiZTJi`

### Frontend
- **React** + **TypeScript** with **Vite**
- **Shadcn UI** components
- **TanStack Query** for data fetching
- **Wouter** for routing
- RTL Arabic interface

## Bot Flow
1. User sends `/start` → if new, starts registration
2. Bot sends 3 terms messages with Accept/Reject inline buttons:
   - Message 1: Account requirements (5000+ Iraqi followers, real account)
   - Message 2: Work plan (like, comment, share story with tag, direct share)
   - Message 3: Payment terms (1000 IQD per full task, 25-30k IQD/day)
3. After accepting all terms → User sends account link + screenshot
4. Bot forwards to approval Telegram group for admin review
5. Admin approves via web dashboard → member gets notified
6. Admin sends tasks to approved members with specific task types + price
7. Member completes task → clicks "تم اكمال المهام" → sends screenshots
8. Screenshots forwarded to payment Telegram group
9. Admin approves payment via web dashboard → balance added to member

## Database Schema
- `members` - Telegram users with status, balance, registration step
- `tasks` - Instagram post links with task types and prices
- `task_submissions` - Member task completions with screenshots

## Task Types
- `like` - Like the post
- `comment` - Comment on the post (with count)
- `share_story` - Share to story with mention/tag
- `explore` - Direct share (explore movement)

## Pricing
- Full tasks (all 4): 1000 IQD
- Partial tasks: 500 IQD

## Web Dashboard Pages
1. **Dashboard** - Stats overview (members, tasks, payments)
2. **Members** - View/approve/reject member registration requests
3. **Tasks** - Create and send tasks to approved members
4. **Payments** - Approve/reject task completion payments

## Key Files
- `server/bot.ts` - Telegram bot logic
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database operations with Drizzle ORM
- `shared/schema.ts` - Database schema and types
- `client/src/pages/` - Dashboard, Members, Tasks, Payments pages
- `client/src/App.tsx` - RTL sidebar layout with Arabic navigation
