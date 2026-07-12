import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const lessonsCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/lessons" }),
  schema: z.object({
    title: z.string(),
    subject: z.string(),       // Subject slug e.g. 'toan-12'
    subject_name: z.string(),  // Subject display name e.g. 'Toán 12'
    description: z.string().optional(),
    video_url: z.string().optional(),
    tags: z.array(z.string()).optional(),
    created_at: z.string().optional(),
    order: z.number().optional(),
  })
});

export const collections = {
  lessons: lessonsCollection,
};
