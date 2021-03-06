import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable} from 'rxjs/Observable';
import {filter} from 'rxjs/operators/filter';
import {take} from 'rxjs/operators/take';
import {Subscription} from 'rxjs/Subscription';
import {IQuillDelta} from '../../iquill-delta';
import {IQuillRange} from '../../iquill-range';
import {LockFunction} from '../../lock-function-type';
import {IAccountFileRecord} from '../../proto';
import {AccountFilesService} from '../../services/account-files.service';
import {AccountService} from '../../services/account.service';
import {DialogService} from '../../services/dialog.service';
import {EnvService} from '../../services/env.service';
import {StringsService} from '../../services/strings.service';
import {lockFunction} from '../../util/lock';
import {sleep} from '../../util/wait';


/**
 * Angular component for an individual note.
 */
@Component({
	selector: 'cyph-account-note',
	styleUrls: ['./account-note.component.scss'],
	templateUrl: './account-note.component.html'
})
export class AccountNoteComponent implements OnInit {
	/** @ignore */
	private editView: boolean	= false;

	/** @ignore */
	private nameSubscription?: Subscription;

	/** @ignore */
	private readonly saveLock: LockFunction	= lockFunction();

	/** Indicates whether or not this is a new note. */
	public newNote: boolean	= false;

	/** Currently active note. */
	public note?: {
		content?: Observable<IQuillDelta>;
		deltas?: Observable<IQuillDelta>;
		metadata: Observable<IAccountFileRecord>;
		selections?: Observable<IQuillRange>;
	};

	/** Most recent note data. */
	public readonly noteData: {
		content?: IQuillDelta;
		id?: string;
		name: string;
	}	= {
		name: ''
	};

	/** Indicates whether or not the real-time doc UI is enabled. */
	public realTime: boolean	= false;

	/** @ignore */
	private async initDoc () : Promise<void> {
		await this.setNote(await this.accountFilesService.upload(this.noteData.name, []).result);
		this.router.navigate([accountRoot, 'docs', this.noteData.id, 'edit']);
	}

	/** @ignore */
	private async setNote (id: string) : Promise<void> {
		const metadata		= this.accountFilesService.watchMetadata(id);
		const metadataValue	= await metadata.pipe(filter(o => !!o.id), take(1)).toPromise();

		this.noteData.id	= metadataValue.id;
		this.noteData.name	= metadataValue.name;

		this.note			= {metadata};

		if (this.realTime) {
			const doc				= await this.accountFilesService.watchDoc(metadataValue.id);
			this.note.deltas		= doc.deltas;
			this.note.selections	= doc.selections;
		}
		else {
			this.note.content	= this.accountFilesService.watchNote(metadataValue.id);
		}

		if (this.nameSubscription) {
			this.nameSubscription.unsubscribe();
		}

		this.nameSubscription	= metadata.subscribe(o => {
			if (o.id === this.noteData.id) {
				this.noteData.name	= o.name;
			}
		});
	}

	/** @ignore */
	private setURL (url: string) : void {
		this.editView	= url.split('/').slice(-1)[0] === 'edit';
	}

	/** Indicates whether or not the edit view should be displayed. */
	public get editable () : boolean {
		return this.editView || this.newNote;
	}

	/** @inheritDoc */
	public ngOnInit () : void {
		this.setURL(this.router.url);
		this.router.events.subscribe(({url}: any) => {
			if (typeof url === 'string') {
				this.setURL(url);
			}
		});

		this.activatedRoute.data.subscribe(o => {
			this.realTime	= o.realTime;

			if (this.realTime && this.newNote) {
				this.initDoc();
			}
		});

		this.activatedRoute.params.subscribe(async o => {
			try {
				const id: string|undefined	= o.id;

				if (!id) {
					throw new Error('Invalid note ID.');
				}

				if (id === 'new') {
					this.newNote			= true;
					this.note				= undefined;
					this.noteData.content	= undefined;
					this.noteData.id		= undefined;
					this.noteData.name		= 'Untitled';

					if (this.realTime) {
						await this.initDoc();
					}
				}
				else {
					this.newNote	= false;
					await this.setNote(id);
				}
			}
			catch {
				this.router.navigate(['404']);
			}
		});
	}

	/** Note change handler. */
	public async onChange (change: {
		content: IQuillDelta;
		delta: IQuillDelta;
		oldContent: IQuillDelta;
	}) : Promise<void> {
		if (!this.realTime) {
			this.noteData.content	= change.content;
			return;
		}

		return this.saveLock(async () => {
			if (!this.noteData.id) {
				return;
			}

			return this.accountFilesService.updateDoc(this.noteData.id, change.delta);
		});
	}

	/** Note selection change handler. */
	public async onSelectionChange (change: {
		oldRange: IQuillRange;
		range: IQuillRange;
	}) : Promise<void> {
		if (!this.realTime) {
			return;
		}

		return this.saveLock(async () => {
			if (!this.noteData.id) {
				return;
			}

			this.accountFilesService.updateDoc(this.noteData.id, change.range);
		});
	}

	/** Updates real-time doc title. */
	public realTimeTitleUpdate (name: string) : void {
		if (!this.realTime) {
			return;
		}

		this.saveLock(async () => {
			if (!this.noteData.id || !name) {
				return;
			}

			this.accountFilesService.updateMetadata(this.noteData.id, {name});
		});
	}

	/** Saves note. */
	public saveNote () : void {
		this.saveLock(async () => {
			if (!this.noteData.name) {
				return;
			}

			if (!this.noteData.content) {
				this.noteData.content	= this.note && this.note.content ?
					await this.note.content.pipe(take(1)).toPromise() :
					<IQuillDelta> (<any> {clientID: '', ops: []})
				;
			}

			this.accountService.interstitial	= true;

			if (this.newNote) {
				this.noteData.id	=
					await this.accountFilesService.upload(
						this.noteData.name,
						this.noteData.content
					).result
				;
				await this.setNote(this.noteData.id);
			}
			else if (
				this.note &&
				(await this.note.metadata.pipe(take(1)).toPromise()).id === this.noteData.id
			) {
				await this.accountFilesService.updateNote(
					this.noteData.id,
					this.noteData.content,
					this.noteData.name
				);
			}

			if (this.noteData.id) {
				this.router.navigate([accountRoot, 'notes', this.noteData.id]);
				await sleep();
				this.accountService.interstitial	= false;
				this.dialogService.toast(this.stringsService.noteSaved, 2500);
			}
		});
	}

	constructor (
		/** @ignore */
		private readonly activatedRoute: ActivatedRoute,

		/** @ignore */
		private readonly router: Router,

		/** @see AccountService */
		public readonly accountService: AccountService,

		/** @see AccountFilesService */
		public readonly accountFilesService: AccountFilesService,

		/** @see DialogService */
		public readonly dialogService: DialogService,

		/** @see EnvService */
		public readonly envService: EnvService,

		/** @see StringsService */
		public readonly stringsService: StringsService
	) {}
}
