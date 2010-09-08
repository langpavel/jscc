/*
	This is the general, platform-independent part of every parser driver;
	Input-/Output and Feature-Functions are done by the particular drivers
	created for the particular platform.
*/

function __##PREFIX##lex( PCB )
{
	var state;
	var match		= -1;
	var match_pos	= 0;
	var start		= 0;
	var pos;
	var chr;

	while( 1 )
	{
		state = 0;
		match = -1;
		match_pos = 0;
		start = 0;
		pos = PCB.offset + 1 + ( match_pos - start );

		do
		{
			pos--;
			state = 0;
			match = -2;
			start = pos;
	
			if( PCB.src.length <= start )
				return ##EOF##;
	
			do
			{
				chr = PCB.src.charCodeAt( pos );

##DFA##

				//Line- and column-counter
				if( state > -1 )
				{
					if( chr == 10 )
					{
						PCB.line++;
						PCB.column = 0;
					}
					PCB.column++;
				}

				pos++;
	
			}
			while( state > -1 );
	
		}
		while( ##WHITESPACE## > -1 && match == ##WHITESPACE## );
	
		if( match > -1 )
		{
			PCB.att = PCB.src.substr( start, match_pos - start );
			PCB.offset = match_pos;
			
##TERMINAL_ACTIONS##
		}
		else
		{
			PCB.att = new String();
			match = -1;
		}
		
		break;
	}

	return match;
}

function __##PREFIX##parse( src, err_off, err_la )
{
	var		sstack			= new Array();
	var		vstack			= new Array();
	var 	err_cnt			= 0;
	var		rval;
	var		act;
	
	//PCB: Parser Control Block
	var 	parsercontrol	= new Function( "",
								"var la;" +
								"var act;" +
								"var offset;" +
								"var src;" +
								"var att;" +
								"var line;" +
								"var column;" +
								"var error_step;" );
	var		PCB	= new parsercontrol();
	
	//Visual parse tree generation
	var 	treenode		= new Function( "",
								"var sym;"+
								"var att;"+
								"var child;" );
	var		treenodes		= new Array();
	var		tree			= new Array();
	var		tmptree			= null;

##TABLES##

##LABELS##
	
	PCB.line = 1;
	PCB.column = 1;
	PCB.offset = 0;
	PCB.error_step = 0;
	PCB.src = src;
	PCB.att = new String();

	if( !err_off )
		err_off	= new Array();
	if( !err_la )
		err_la = new Array();
	
	sstack.push( 0 );
	vstack.push( 0 );
	
	PCB.la = __##PREFIX##lex( PCB );
			
	while( true )
	{
		PCB.act = ##ERROR##;
		for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
		{
			if( act_tab[sstack[sstack.length-1]][i] == PCB.la )
			{
				PCB.act = act_tab[sstack[sstack.length-1]][i+1];
				break;
			}
		}
		
		if( PCB.act == ##ERROR## )
		{
			if( ( PCB.act = defact_tab[ sstack[sstack.length-1] ] ) < 0 )
				PCB.act = ##ERROR##;
			else
				PCB.act *= -1;
		}

		/*
		_print( "state " + sstack[sstack.length-1] +
				" la = " +
				PCB.la + " att = >" +
				PCB.att + "< act = " +
				PCB.act + " src = >" +
				PCB.src.substr( PCB.offset, 30 ) + "..." + "<" +
				" sstack = " + sstack.join() );
		*/
		
		if( ##PREFIX##_dbg_withtrace && sstack.length > 0 )
		{
			__##PREFIX##dbg_print( "\nState " + sstack[sstack.length-1] + "\n" +
							"\tLookahead: " + labels[PCB.la] +
								" (\"" + PCB.att + "\")\n" +
							"\tAction: " + PCB.act + "\n" + 
							"\tSource: \"" + PCB.src.substr( PCB.offset, 30 ) +
									( ( PCB.offset + 30 < PCB.src.length ) ?
										"..." : "" ) + "\"\n" +
							"\tStack: " + sstack.join() + "\n" +
							"\tValue stack: " + vstack.join() + "\n" );
			
			if( ##PREFIX##_dbg_withstepbystep )
				__##PREFIX##dbg_wait();
		}
		
			
		//Parse error? Try to recover!
		if( PCB.act == ##ERROR## )
		{
			if( ##PREFIX##_dbg_withtrace )
			{
				var expect = new String();
				
				__##PREFIX##dbg_print( "Error detected: " +
					"There is no reduce or shift on the symbol " +
						labels[PCB.la] );
				
				for( var i = 0; i < act_tab[sstack[sstack.length-1]].length;
						i+=2 )
				{
					if( expect != "" )
						expect += ", ";
						
					expect += "\"" +
								labels[ act_tab[sstack[sstack.length-1]][i] ]
									+ "\"";
				}
				
				__##PREFIX##dbg_print( "Expecting: " + expect );
			}
			
			//Report errors only when error_step is 0, and this is not a
			//subsequent error from a previous parse
			if( PCB.error_step == 0 )
			{
				err_cnt++;
				err_off.push( PCB.offset - PCB.att.length );
				err_la.push( new Array() );
				for( var i = 0; i < act_tab[sstack[sstack.length-1]].length;
						i+=2 )
					err_la[err_la.length-1].push(
							labels[act_tab[sstack[sstack.length-1]][i]] );
			}
			
			//Perform error recovery			
			while( sstack.length > 1 && PCB.act == ##ERROR## )
			{
				sstack.pop();
				vstack.pop();
				
				//Try to shift on error token
				for( var i = 0; i < act_tab[sstack[sstack.length-1]].length;
						i+=2 )
				{
					if( act_tab[sstack[sstack.length-1]][i] == ##ERROR_TOKEN## )
					{
						PCB.act = act_tab[sstack[sstack.length-1]][i+1];
						
						sstack.push( PCB.act );
						vstack.push( new String() );
						
						if( ##PREFIX##_dbg_withtrace )
						{
							__##PREFIX##dbg_print(
								"Error recovery: error token " +
									"could be shifted!" );
							__##PREFIX##dbg_print( "Error recovery: " +
									"current stack is " + sstack.join() );
						}

						break;
					}
				}
			}
			
			//Is it better to leave the parser now?
			if( sstack.length > 1 && PCB.act != ##ERROR## )
			{
				//Ok, now try to shift on the next tokens
				while( PCB.la != ##EOF## )
				{
					if( ##PREFIX##_dbg_withtrace )
						__##PREFIX##dbg_print( "Error recovery: " +
							"Trying to shift on \""
								+ labels[ PCB.la ] + "\"" );

					PCB.act = ##ERROR##;
					
					for( var i = 0; i < act_tab[sstack[sstack.length-1]].length;
							i+=2 )
					{
						if( act_tab[sstack[sstack.length-1]][i] == PCB.la )
						{
							PCB.act = act_tab[sstack[sstack.length-1]][i+1];
							break;
						}
					}
					
					if( PCB.act != ##ERROR## )
						break;
						
					if( ##PREFIX##_dbg_withtrace )
						__##PREFIX##dbg_print( "Error recovery: Discarding \""
							+ labels[ PCB.la ] + "\"" );
					
					while( ( PCB.la = __##PREFIX##lex( PCB ) )
								< 0 )
						PCB.offset++;
				
					if( ##PREFIX##_dbg_withtrace )
						__##PREFIX##dbg_print( "Error recovery: New token \""
							+ labels[ PCB.la ] + "\"" );
				}
				while( PCB.la != ##EOF## && PCB.act == ##ERROR## );
			}
			
			if( PCB.act == ##ERROR## || PCB.la == ##EOF## )
			{
				if( ##PREFIX##_dbg_withtrace )
					__##PREFIX##dbg_print( "\tError recovery failed, " +
							"terminating parse process..." );
				break;
			}

			if( ##PREFIX##_dbg_withtrace )
				__##PREFIX##dbg_print( "\tError recovery succeeded, " +
											"continuing" );
			
			//Try to parse the next three tokens successfully...
			PCB.error_step = 3;
		}

		//Shift
		if( PCB.act > 0 )
		{
			//Parse tree generation
			if( ##PREFIX##_dbg_withparsetree )
			{
				var node = new treenode();
				node.sym = labels[ PCB.la ];
				node.att = PCB.att;
				node.child = new Array();
				tree.push( treenodes.length );
				treenodes.push( node );
			}
			
			if( ##PREFIX##_dbg_withtrace )
				__##PREFIX##dbg_print( "Shifting symbol: " +
						labels[PCB.la] + " (" + PCB.att + ")" );
		
			sstack.push( PCB.act );
			vstack.push( PCB.att );
			
			PCB.la = __##PREFIX##lex( PCB );
			
			if( ##PREFIX##_dbg_withtrace )
				__##PREFIX##dbg_print( "\tNew lookahead symbol: " +
						labels[PCB.la] + " (" + PCB.att + ")" );
				
			//Successfull shift and right beyond error recovery?
			if( PCB.error_step > 0 )
				PCB.error_step--;
		}
		//Reduce
		else
		{		
			act = PCB.act * -1;
			
			if( ##PREFIX##_dbg_withtrace )
				__##PREFIX##dbg_print( "Reducing by production: " + act );
			
			rval = void( 0 );
			
			if( ##PREFIX##_dbg_withtrace )
				__##PREFIX##dbg_print( "\tPerforming semantic action..." );
			
##ACTIONS##
			
			if( ##PREFIX##_dbg_withparsetree )
				tmptree = new Array();

			if( ##PREFIX##_dbg_withtrace )
				__##PREFIX##dbg_print( "\tPopping " + 
									pop_tab[act][1] +  " off the stack..." );
				
			for( var i = 0; i < pop_tab[act][1]; i++ )
			{
				if( ##PREFIX##_dbg_withparsetree )
					tmptree.push( tree.pop() );
					
				sstack.pop();
				vstack.pop();
			}

			//Get goto-table entry
			PCB.act = ##ERROR##;
			for( var i = 0; i < goto_tab[sstack[sstack.length-1]].length; i+=2 )
			{
				if( goto_tab[sstack[sstack.length-1]][i] == pop_tab[act][0] )
				{
					PCB.act = goto_tab[sstack[sstack.length-1]][i+1];
					break;
				}
			}
			
			//Do some parse tree construction if desired
			if( ##PREFIX##_dbg_withparsetree )
			{
				var node = new treenode();
				node.sym = labels[ pop_tab[act][0] ];
				node.att = rval;
				node.child = tmptree.reverse();
				tree.push( treenodes.length );
				treenodes.push( node );
			}
			
			//Goal symbol match?
			if( act == 0 ) //Don't use PCB.act here!
				break;
				
			if( ##PREFIX##_dbg_withtrace )
				__##PREFIX##dbg_print( "\tPushing non-terminal " + 
						labels[ pop_tab[act][0] ] );
			
			//...and push it!
			sstack.push( PCB.act );
			vstack.push( rval );
		}
	}

	if( ##PREFIX##_dbg_withtrace )
	{
		__##PREFIX##dbg_print( "\nParse complete." );
		
		//This function is used for parser drivers that will output
		//the entire debug messages in a row.
		__##PREFIX##dbg_flush();
	}

	if( ##PREFIX##_dbg_withparsetree )
	{
		if( err_cnt == 0 )
		{
			__##PREFIX##dbg_print( "\n\n--- Parse tree ---" );
			__##PREFIX##dbg_parsetree( 0, treenodes, tree );
		}
		else
		{
			__##PREFIX##dbg_print( "\n\nParse tree cannot be viewed. " +
									"There where parse errors." );
		}
	}
	
	return err_cnt;
}

##FOOTER##
