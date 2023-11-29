import chai from 'chai';
import Sinon from 'sinon';
import * as authModule from '../utils/auth';
import { mockedToken } from './utils';

describe('isRequired Middleware', async function () {
  let req;
  let res;
  let next;
  let checkTokenStub;
  let sandbox;

  beforeEach(async function () {
    sandbox = Sinon.createSandbox();
    checkTokenStub = sandbox.stub(authModule, 'checkToken');

    req = {
      headers: {},
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.spy(),
      locals: sandbox.spy(),
    };
    next = sandbox.spy();
  });

  afterEach(async function () {
    sandbox.restore();
  });

  it('Should return 403 if no credentials sent', async function () {
    await authModule.isRequired(req, res, next);
    chai.expect(res.status.calledOnceWith(403)).to.be.true;
    chai.expect(res.json.calledOnceWith({ message: 'No credentials sent' })).to
      .be.true;
    chai.expect(next.notCalled).to.be.true;
  });

  it('Should return 403 for wrong authentication method', async function () {
    req.headers.authorization = 'Basic token';
    await authModule.isRequired(req, res, next);
    chai.expect(res.status.calledOnceWith(403)).to.be.true;
    chai.expect(
      res.json.calledOnceWith({ message: 'Wrong authentication method' }),
    ).to.be.true;
    chai.expect(next.notCalled).to.be.true;
  });

  it('Should return 401 for invalid token', async function () {
    req.headers.authorization = 'Bearer invalid_token';
    checkTokenStub.rejects(new Error('Invalid token'));
    await authModule.isRequired(req, res, next);
    chai.expect(res.status.calledOnceWith(401)).to.be.true;
    chai.expect(res.json.calledOnce).to.be.true;
    chai.expect(next.notCalled).to.be.true;
  });

  it('Should set userId and workspaceId in locals', async function () {
    req.headers.authorization = `Bearer ${await mockedToken}`;

    checkTokenStub.returns({
      sub: 'user_id',
      workspace: 'workspace_id',
    });

    await authModule.isRequired(req, res, next);
    chai.expect(next.calledOnce).to.be.true;
    chai
      .expect(res.locals.userId)
      .to.equal('eip155:1:0x10A2C306cCc87938B1fe3c63DBb1457A9c810df5');
    chai.expect(res.locals.workspaceId).to.equal(undefined);
  });
});
