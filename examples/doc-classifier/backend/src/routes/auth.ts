import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';

export async function authRoute(fastify: FastifyInstance) {
  fastify.post('/api/auth/signup', async (req: any, reply: FastifyReply) => {
    const { email, password } = req.body;
    if (!email || !password) return reply.code(400).send({ error: 'Email and password required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return reply.code(400).send({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();

    return reply.send({ success: true, user: { id: user._id, email: user.email } });
  });

  fastify.post('/api/auth/login', async (req: any, reply: FastifyReply) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return reply.code(401).send({ error: 'Invalid credentials' });

    return reply.send({ success: true, user: { id: user._id, email: user.email } });
  });
}
