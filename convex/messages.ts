import { v } from "convex/values"
import { mutation, query } from "./_generated/server.js"

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("messages").order("desc").take(50)
  },
})

export const send = mutation({
  args: {
    author: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      author: args.author,
      body: args.body,
      timestamp: Date.now(),
    })
  },
})
