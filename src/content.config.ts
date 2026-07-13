import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const lessonsCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.json', base: "./src/content/lessons" }),
  schema: z.object({
    subject: z.string(),
    subject_id: z.number().optional(),
    lessons: z.array(z.any())
  })
});

export const collections = {
  lessons: lessonsCollection,
};
